import { openai } from '../openai';
import { prisma } from '../prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { question, previousQuestionId } = await request.json();

  const questionRecord = await prisma.question.create({
    data: {
      text: question,
      previousQuestionId,
    }
  })

  return NextResponse.json({ questionId: questionRecord.id });
}


// kind of awkward that this is a PATCH request but it's nice to keep
// these two in the same file and it doesn't really matter in practice
export async function PATCH(request: Request) {
  const { question, history, questionId } = await request.json();

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
