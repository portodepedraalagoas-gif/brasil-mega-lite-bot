import { publishSuggestion } from '../services/suggestions.js';

const definition = {
  name: 'sugestao',
  description: 'Envie uma ideia para melhorar o Brasil Mega Lite.',
  options: [{
    type: 3,
    name: 'ideia',
    description: 'O que você gostaria de sugerir para o servidor?',
    required: true,
    min_length: 5,
    max_length: 1000
  }]
};

export const data = { name: definition.name, toJSON: () => definition };

export async function execute(interaction) {
  await publishSuggestion(interaction, interaction.options.getString('ideia', true));
}
