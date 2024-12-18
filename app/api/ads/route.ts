import { openai } from '../openai';
import { prisma } from '../prisma';
import { NextResponse } from 'next/server';
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const UNCATEGORIZED = 'Uncategorized';

function systemMessage(categories: string[]) {
  return `
    Classify the final question into one of the following categories:

    ${categories.join("\n")}

    You may take into account the question history but should primarily
    focus on the final question.

    You may also optionally decline to classify the question, in which case
    you should respond with ${UNCATEGORIZED}.
    `
}


export async function POST(request: Request) {
  const { question, history, questionId, previousQuestionId } = await request.json();

  /* --------- Get the categories to use for classification --------*/
  const categoriesData = await prisma.category.findMany({
    where: {
      active: true,
    }
  });
  const categories = categoriesData.map((category) => category.name);
  const categoriesWithUncategorized = categories.concat([UNCATEGORIZED]);

  /* --------- make OpenAI classification request --------*/
  let completion;
  try {
    const responseFormat = z.object({
      // this is illegal because allegedly zod needs to know the exact enum values
      // (i.e. it needs a literal type) to validate them, but it seems to work
      // and it's the only way to use structured outputs with a dynamic enum
      // @ts-expect-error
      category: z.enum(categoriesWithUncategorized),
    });
    console.log("process.env['OPENAI_API_KEY']:", process.env['OPENAI_API_KEY']);
    completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini-2024-07-18",
      messages: [
          { role: "system", content: systemMessage(categories) },
          ...history,
          { role: "user", content: question },
      ],
      response_format: zodResponseFormat(responseFormat, "category"),
    });
  } catch (error: any) {
    // catch OpenAI errors and return them
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* --------- Find category and, if it exists, assigned partner --------*/
  let selectedCategory, partner = null;
  const selectedCategoryName = completion.choices[0].message.parsed?.category;
  if (!selectedCategoryName) {
    return NextResponse.json({
      error: 'Did not receive a category from OpenAI' },
      { status: 500 }
    );
  } else if (selectedCategoryName !== UNCATEGORIZED) {
    // I would rather pass in the name and ID to OpenAI and have them return
    // both so we can avoid this extra step, but it seems to mess with the LLM
    selectedCategory = categoriesData.find(
      category => category.name === selectedCategoryName
    );
    if (!selectedCategory) {
      return NextResponse.json({
        error: `OpenAI selected an invalid category: ${selectedCategoryName}` },
        { status: 500 }
      );
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

  /* --------- Update database --------*/
  // upsert because of potential race condition with ask endpoint, though in practice
  // this will likely always be an update as opposed to an insert if the requests
  // are initiated approx simultaneously (which they should be)
  // we should not have to worry about pk conflicts since we are using database upserts:
  // https://www.prisma.io/docs/orm/reference/prisma-client-reference#database-upserts
  const updatedFields = {
    categoryId: selectedCategory?.id,
    partnerId: partner?.id,
    categorizedAt: new Date(),
  }
  await prisma.question.upsert({
    where: {
      id: questionId,
    },
    create: {
      id: questionId,
      text: question,
      previousQuestionId,
      ...updatedFields
    },
    update: {
      ...updatedFields
    },
  });

  /* --------- return ad tag URL for the selected partner --------*/
  if (partner && selectedCategory) {
    // add category name and ID as query parameters
    const url = new URL(partner.adTagUrl);
    url.searchParams.append('categoryName', selectedCategory.name);
    url.searchParams.append('categoryId', selectedCategory.id.toString());
    return NextResponse.json({adTagUrl: url.toString()});
  } else {
    return NextResponse.json({ adTagUrl: '' });
  }
}
