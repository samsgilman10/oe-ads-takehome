import { openai } from '../openai';
import { NextResponse } from 'next/server';
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { PrismaClient } from '@prisma/client'

const UNCATEGORIZED = 'Uncategorized';

const prisma = new PrismaClient();

function systemMessage(categories: string[]) {
  return `
    Classify the following question into one of the following categories:

    ${categories.join("\n")}

    You may also optionally decline to classify the question, in which case
    you should respond with ${UNCATEGORIZED}.
    `
}


export async function POST(request: Request) {
  const { question, questionId } = await request.json();

  const categoriesData = await prisma.category.findMany()

  const categories = categoriesData.map((category) => category.name);

  const categoriesWithUncategorized = categories.concat([UNCATEGORIZED]);

  const responseFormat = z.object({
    // this is illegal because allegedly zod needs to know the exact enum values
    // (i.e. it needs a literal type) to validate them, but it seems to work
    // and it's the only way to use structured outputs with a dynamic enum
    // @ts-expect-error
    category: z.enum(categoriesWithUncategorized),
  });

  console.log("process.env['OPENAI_API_KEY']:", process.env['OPENAI_API_KEY']);

  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o-mini-2024-07-18",
    messages: [
        { role: "system", content: systemMessage(categories) },
        { role: "user", content: question },
    ],
    response_format: zodResponseFormat(responseFormat, "category"),
   });

  const selectedCategoryName = completion.choices[0].message.parsed?.category;

  let selectedCategory, partner = null;

  // get the category and, if it exists, the assigned partner
  if (selectedCategoryName !== UNCATEGORIZED) {
    // I would rather pass in the name and ID to OpenAI and have them return
    // both so we can avoid this extra step, but it seems to mess with the LLM
    selectedCategory = categoriesData.find(
      category => category.name === selectedCategoryName
    );

    if (!selectedCategory) {
      // for typing consistency, but this should never happen
      throw new Error(`Could not find category with name ${selectedCategoryName}`);
    }

    // get assigned partner if they exist
    if (selectedCategory.assignedPartnerId) {
      partner = await prisma.partner.findUnique({
        where: {
          id: selectedCategory.assignedPartnerId
        }
      });
    }
  }

  // update database
  await prisma.question.update({
    where: {
      id: questionId,
    },
    data: {
      categoryId: selectedCategory?.id,
      partnerId: partner?.id,
      categorizedAt: new Date(),
    }
  });

  if (partner && selectedCategory) {
    return NextResponse.json({ 
      adTagUrl: `${partner.adTagUrl}?categoryName=${
        encodeURIComponent(selectedCategory.name)
      }&categoryId=${
        selectedCategory.id
      }` });
  } else {
    return NextResponse.json({ adTagUrl: '' });
  }
}
