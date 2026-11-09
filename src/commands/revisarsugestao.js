import { config } from '../config.js';
import { reviewStatuses, reviewSuggestion } from '../services/suggestions.js';

const definition = {
  name: 'revisarsugestao',
  description: 'Registre a decisão da staff sobre uma sugestão.',
  options: [
    { type: 3, name: 'mensagem', description: 'Link ou ID da mensagem original da sugestão', required: true, max_length: 160 },
    { type: 3, name: 'status', description: 'Decisão sobre a sugestão', required: true,
      choices: Object.entries(reviewStatuses).map(([value, { label }]) => ({ name: label, value })) },
    { type: 3, name: 'motivo', description: 'Justificativa que será publicada no tópico', required: true, min_length: 5, max_length: 1000 }
  ]
};

export const data = { name: definition.name, toJSON: () => definition };

export async function execute(interaction) {
  const { options } = interaction;
  await reviewSuggestion(interaction, config.staffRoleId,
    options.getString('mensagem', true), options.getString('status', true), options.getString('motivo', true));
}
