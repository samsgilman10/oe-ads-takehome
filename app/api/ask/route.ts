import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient();

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

export async function POST(request: Request) {
  const { question, history } = await request.json();

  console.log("process.env['OPENAI_API_KEY']:", process.env['OPENAI_API_KEY']);

  const partner = await prisma.partner.findUnique({
    where: {
      id: 1
    }
  })

  try {
    const chatCompletion = await client.chat.completions.create({
      messages: [
        ...history,
        { role: 'user', content: question }],
      model: 'gpt-3.5-turbo',
    });

    return NextResponse.json({ answer: partner?.name ?? '' + chatCompletion.choices[0].message.content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}