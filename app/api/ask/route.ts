import { openai } from '../openai';
import { prisma } from '../prisma';
import { NextResponse } from 'next/server';


export async function POST(request: Request) {
  const { question, history, questionId, previousQuestionId } = await request.json();

  // upsert because of potential race condition with ask endpoint, though in practice
  // this will likely always be an insert as opposed to an update if the requests
  // are initiated approx simultaneously (which they should be)
  // we should not have to worry about pk conflicts since we are using database upserts:
  // https://www.prisma.io/docs/orm/reference/prisma-client-reference#database-upserts
  await prisma.question.upsert({
    where: {
      id: questionId,
    },
    create: {
      id: questionId,
      text: question,
      previousQuestionId,
    },
    update: {},
  });

  console.log("process.env['OPENAI_API_KEY']:", process.env['OPENAI_API_KEY']);

  // Simulate real world scenario where question answering takes longer
  // than classification
  await new Promise(r => setTimeout(r, 5000));

  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        ...history,
        { role: 'user', content: question }],
      model: 'gpt-3.5-turbo',
    });

    const answer = chatCompletion.choices[0].message.content;

    await prisma.question.update({
      where: { id: questionId },
      data: {
        answer,
        answeredAt: new Date(),
      }
    });

    return NextResponse.json({ answer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
