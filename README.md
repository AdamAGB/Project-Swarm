# AI Persona Market Research

A web application that generates 100 AI personas representing a market you describe, allows you to ask questions, and displays rating distributions with statistics.

## Features

- Generate 100 diverse AI personas based on market description
- Each persona has:
  - Demographics (age, income, education, occupation, location)
  - Big Five personality traits (openness, conscientiousness, extraversion, agreeableness, neuroticism)
  - Unique background story
- Ask questions and get ratings (1-5) from all personas
- View results as a histogram with statistics:
  - Mean, median, standard deviation, mode
  - Distribution breakdown
  - Percentage analysis

## Prerequisites

- Node.js (v16 or higher)
- npm
- OpenAI API key (get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys))

## Setup Instructions

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Get your OpenAI API key**
   - Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key (it starts with `sk-`)

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   - The app will run at `http://localhost:5173` (or the port shown in terminal)
   - Enter your OpenAI API key in the app (it's stored in your browser's localStorage)

## How to Use

1. **Enter API Key**: Paste your OpenAI API key and click "Save"
2. **Describe Market**: Describe your target market (e.g., "tech-savvy millennials in urban areas with $50k-$150k income")
3. **Generate Personas**: Click "Generate 100 Personas" and wait 10-30 seconds
4. **Ask Question**: Enter a question you want to test (e.g., "Would you pay $50/month for this product?")
5. **View Results**: See the rating distribution, statistics, and histogram

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **AI**: OpenAI GPT-4o-mini
- **Charts**: Chart.js + react-chartjs-2
- **Styling**: CSS3

## Project Structure

```
src/
├── components/          # React components
│   ├── ApiKeyInput.tsx
│   ├── MarketDescriptionForm.tsx
│   ├── PersonaList.tsx
│   ├── QuestionForm.tsx
│   └── ResultsChart.tsx
├── services/
│   └── openai.ts       # OpenAI API integration
├── types/
│   └── index.ts        # TypeScript type definitions
├── utils/
│   └── statistics.ts   # Statistics calculations
├── App.tsx             # Main app component
├── App.css             # Styles
└── main.tsx            # Entry point
```

## Cost Estimates

Using OpenAI GPT-4o-mini:
- Persona generation: ~$0.05-$0.15 per run
- Rating 100 personas: ~$0.10-$0.30 per question
- Total per market research cycle: ~$0.15-$0.45

Costs are approximate and depend on market complexity and question detail.

## Customization

### Change AI Model
In `src/services/openai.ts`, change the model:
```typescript
model: 'gpt-4o-mini'  // or 'gpt-4o', 'gpt-3.5-turbo'
```

### Adjust Number of Personas
In `src/services/openai.ts`, modify the prompt to generate more/fewer personas.

### Customize Personality Traits
Edit the `Persona` type in `src/types/index.ts` to add or remove traits.

## Troubleshooting

**"Failed to generate personas" error**
- Check that your API key is correct
- Ensure you have credits in your OpenAI account
- Check browser console for detailed error messages

**Slow persona generation**
- This is normal, generating 100 detailed personas takes 15-30 seconds
- Using gpt-4o-mini (default) is faster than gpt-4o

**Rate limit errors**
- The app includes rate limiting (3 concurrent requests max)
- If you still hit limits, wait a few minutes and try again

## Security Note

Your API key is stored in browser localStorage and sent directly to OpenAI. Never commit API keys to git or share them publicly.

## License

MIT
