import { openai } from '../openai';
import { NextResponse } from 'next/server';
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient();

function systemMessage(categories: string[]) {
  return `
    Classify the following question into one of the following categories:

    ${categories.join("\n")}

    You may also optionally decline to classify the question, in which case
    you should respond with "Uncategorized".
    `
}


export async function POST(request: Request) {
  const { question } = await request.json();

  const categoriesData = await prisma.category.findMany()

  const categories = categoriesData.map((category) => category.name);

  const categoriesWithUncategorized = categories.concat(["Uncategorized"]);

  const responseFormat = z.object({
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

    // I would rather pass in the name and ID to OpenAI and have them return
    // both so we can avoid this extra step, but it seems to mess with the LLM
    const selectedCategory = categoriesData.find(
      category => category.name === selectedCategoryName
    );

    // get associated partner
    const partner = await prisma.partner.findUnique({
      where: {
        id: selectedCategory.assignedPartnerId
      }
    });

    return NextResponse.json({ 
      adTagUrl: `${partner.adTagUrl}?categoryName=${
        encodeURIComponent(selectedCategory.name)
      }&categoryId=${
        selectedCategory.id
      }` });
}
