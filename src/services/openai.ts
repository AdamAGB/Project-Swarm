import OpenAI from 'openai';
import type { Persona, RatingResult, VotingResult } from '../types';

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // Required for client-side usage
    });
  }

  async generatePersonas(marketDescription: string): Promise<Persona[]> {
    try {
      const prompt = `Generate exactly 50 diverse AI personas that represent the following market:

"${marketDescription}"

Each persona should have:
- A realistic name
- Age (between 18-80)
- Household income (reasonable range for the market)
- Big Five personality traits (openness, conscientiousness, extraversion, agreeableness, neuroticism) scored 0-100
- Brief background description (1-2 sentences)
- Education level, occupation, and location

Ensure diversity in:
- Demographics (age, income, location)
- Personality types
- Occupations and education levels

Return a JSON object with a "personas" array containing exactly 50 persona objects with this exact structure:
{
  "personas": [
    {
      "id": number,
      "name": string,
      "age": number,
      "householdIncome": number,
      "personality": {
        "openness": number,
        "conscientiousness": number,
        "extraversion": number,
        "agreeableness": number,
        "neuroticism": number
      },
      "background": string,
      "demographics": {
        "education": string,
        "occupation": string,
        "location": string
      }
    }
  ]
}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a market research assistant that generates realistic diverse personas. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const personas = parsed.personas || parsed;

      if (!Array.isArray(personas)) {
        throw new Error('Expected array of personas');
      }

      return personas;
    } catch (error) {
      console.error('Error generating personas:', error);
      throw new Error(`Failed to generate personas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async rateQuestion(
    personas: Persona[],
    question: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<RatingResult[]> {
    const results: RatingResult[] = [];
    const batchSize = 10;
    const maxConcurrent = 3;

    const batches: Persona[][] = [];
    for (let i = 0; i < personas.length; i += batchSize) {
      batches.push(personas.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const currentBatches = batches.slice(i, i + maxConcurrent);
      const batchPromises = currentBatches.map(batch =>
        this.rateBatch(batch, question)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());

      if (onProgress) {
        onProgress(results.length, personas.length);
      }
    }

    return results;
  }

  private async rateBatch(personas: Persona[], question: string): Promise<RatingResult[]> {
    try {
      const prompt = `You are simulating ${personas.length} different REAL people with diverse opinions responding to a question.

Question: "${question}"

Rating Scale (1-10):
1-2 = Strongly disagree/dislike - This doesn't appeal to me at all
3-4 = Disagree/dislike - Not interested or relevant to me
5-6 = Neutral/uncertain - Could go either way, not convinced
7-8 = Agree/like - Somewhat interested, could see value
9-10 = Strongly agree/love - Very interested, definitely would do this

Personas:
${personas.map(p => `
ID: ${p.id}
Name: ${p.name}, Age: ${p.age}, Income: $${p.householdIncome}
Personality: Openness=${p.personality.openness}, Conscientiousness=${p.personality.conscientiousness}, Extraversion=${p.personality.extraversion}, Agreeableness=${p.personality.agreeableness}, Neuroticism=${p.personality.neuroticism}
Background: ${p.background}
Education: ${p.demographics.education}, Occupation: ${p.demographics.occupation}
`).join('\n')}

For each persona, consider their unique characteristics:
- Their background, income, and life situation
- Their personality traits and how they influence preferences
- Whether this question is relevant to their specific circumstances

Return a JSON object with a "ratings" array containing exactly ${personas.length} objects in this format:
{
  "ratings": [
    {
      "personaId": number,
      "rating": number (1-10),
      "reasoning": string (brief 1-sentence summary of their thoughts)
    }
  ]
}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are simulating realistic human responses to survey questions. Provide honest, diverse ratings based on persona characteristics. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const ratings = parsed.ratings || parsed;

      if (!Array.isArray(ratings)) {
        throw new Error('Expected array of ratings');
      }

      return ratings;
    } catch (error) {
      console.error('Error rating batch:', error);
      throw new Error(`Failed to rate batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async collectVotes(
    personas: Persona[],
    question: string,
    options: string[],
    onProgress?: (current: number, total: number) => void
  ): Promise<VotingResult[]> {
    const results: VotingResult[] = [];
    const batchSize = 10;
    const maxConcurrent = 3;

    const batches: Persona[][] = [];
    for (let i = 0; i < personas.length; i += batchSize) {
      batches.push(personas.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const currentBatches = batches.slice(i, i + maxConcurrent);
      const batchPromises = currentBatches.map(batch =>
        this.voteBatch(batch, question, options)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());

      if (onProgress) {
        onProgress(results.length, personas.length);
      }
    }

    return results;
  }

  private async voteBatch(personas: Persona[], question: string, options: string[]): Promise<VotingResult[]> {
    try {
      const prompt = `You are simulating ${personas.length} different REAL people with diverse opinions voting on a multiple choice question.

Question: "${question}"

Options:
${options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}

Personas:
${personas.map(p => `
ID: ${p.id}
Name: ${p.name}, Age: ${p.age}, Income: $${p.householdIncome}
Personality: Openness=${p.personality.openness}, Conscientiousness=${p.personality.conscientiousness}, Extraversion=${p.personality.extraversion}, Agreeableness=${p.personality.agreeableness}, Neuroticism=${p.personality.neuroticism}
Background: ${p.background}
Education: ${p.demographics.education}, Occupation: ${p.demographics.occupation}
`).join('\n')}

For each persona, consider their unique characteristics:
- Their background, income, and life situation
- Their personality traits and how they influence preferences
- Which option would best align with their circumstances and values

Each persona must select EXACTLY ONE option from the list above.

IMPORTANT: Write the reasoning in FIRST PERSON, as if the persona themselves is speaking (use "I", "my", "me").

Return a JSON object with a "votes" array containing exactly ${personas.length} objects in this format:
{
  "votes": [
    {
      "personaId": number,
      "selectedOption": string (must be exactly one of the options listed above),
      "reasoning": string (brief 1-sentence in FIRST PERSON explaining their choice, e.g., "I prefer this because...")
    }
  ]
}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are simulating realistic human responses to voting questions. Provide honest, diverse votes based on persona characteristics. Write all reasoning in FIRST PERSON as if each persona is speaking directly (use "I", "my", "me"). Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const votes = parsed.votes || parsed;

      if (!Array.isArray(votes)) {
        throw new Error('Expected array of votes');
      }

      return votes;
    } catch (error) {
      console.error('Error voting batch:', error);
      throw new Error(`Failed to vote batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
