# Brasil Mega Lite Bot — V2

## Novidades
- /status, /players, /ip e /ajuda
- /painel: painel automático do MTA (admin)
- /verificacao: painel com botão Verificar (admin)
- cargo automático ao verificar
- aviso de boas-vindas opcional
- presença com jogadores online

## Atualizando da V1
1. Copie seu `.env` antigo para esta pasta V2.
2. Acrescente no `.env`:
   VERIFIED_ROLE_ID=
   VERIFICATION_CHANNEL_ID=
   PANEL_CHANNEL_ID=
   PANEL_REFRESH_SECONDS=60
3. No Discord, crie um cargo como `Verificado`.
4. Ative Modo Desenvolvedor e copie o ID desse cargo para VERIFIED_ROLE_ID.
5. Em Cargos, deixe o cargo `Brasil Mega Lite` (bot) ACIMA do cargo `Verificado`.
6. No Developer Portal > Robô, ative **Server Members Intent / Intenção de membros do servidor** para o aviso de novos membros.
7. Rode `npm install` e `npm start`.
8. Use `/verificacao` no canal desejado.
9. Use `/painel` no canal desejado.

## Permissões de canais
Para uma verificação real, configure o cargo @everyone para ver somente regras/verificação e negue os demais canais; dê acesso aos demais canais para o cargo `Verificado`.

Observação: Discord não aceita `mtasa://` como URL de botão comum. Por isso `/ip` exibe o endereço pronto para copiar e colar no Quick Connect do MTA.

Atualização de implantação do bot BML.
