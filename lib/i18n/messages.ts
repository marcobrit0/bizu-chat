/**
 * Bizu product copy — Portuguese (Brazil).
 * Single source of truth for user-facing strings (no bilingual routing in MVP).
 */
export const messages = {
  actions: {
    actionFailed: "Falha ao executar a ação",
    back: "Voltar",
    copied: "Copiado!",
    downvoteFailed: "Falha ao descurtir a resposta.",
    modelUnavailableDemo: "Este modelo não está disponível no demo.",
    submitForm: "Enviar formulário",
    submitLoading: "Carregando",
    upvoteFailed: "Falha ao curtir a resposta.",
  },

  artifacts: {
    addComments: "Adicionar comentários",
    addCommentsPrompt:
      "Adicione comentários ao trecho de código para facilitar o entendimento. Responda em português do Brasil.",
    addLogs: "Adicionar logs",
    addLogsPrompt:
      "Adicione logs ao trecho de código para facilitar a depuração. Responda em português do Brasil.",
    addPolish: "Dar um acabamento final",
    addPolishPrompt:
      "Dê um acabamento final ao texto: revise a gramática, adicione títulos de seção para melhorar a estrutura e garanta que tudo flua bem. Responda em português do Brasil.",
    adjustReadingLevelPromptPrefix: "Ajuste o nível de leitura para: ",
    adjustReadingLevelPromptSuffix: ". Responda em português do Brasil.",
    analyzeData: "Analisar e visualizar dados",
    analyzeDataPrompt:
      "Você pode analisar e visualizar os dados criando um novo artefato de código em Python? Responda em português do Brasil.",
    codeDescription:
      "Útil para gerar código; a execução de código está disponível apenas para Python.",
    copyAsCsv: "Copiar como .csv",
    copyCodeToClipboard: "Copiar código",
    copyToClipboard: "Copiar",
    executeCode: "Executar código",
    fixError: "Corrigir erro",
    fixErrorPromptPrefix: "Corrija o erro no script existente",
    fixErrorPromptSuffix:
      " usando updateDocument. Não crie um novo script. Responda em português do Brasil. Erro do console:",
    formatData: "Formatar e limpar dados",
    formatDataPrompt:
      "Você pode formatar e limpar os dados, por favor? Responda em português do Brasil.",
    latest: "Mais recente",
    of: "de",
    readingLevels: [
      "Ensino fundamental I",
      "Ensino fundamental II",
      "Manter o nível atual",
      "Ensino médio",
      "Graduação",
      "Pós-graduação",
    ],
    requestSuggestions: "Pedir sugestões",
    requestSuggestionsPrompt:
      "Adicione sugestões que possam melhorar o texto. Responda em português do Brasil.",
    restore: "Restaurar",
    run: "Executar",
    sheetDescription: "Útil para trabalhar com planilhas.",
    showChanges: "Ver alterações",
    textDescription:
      "Útil para conteúdo em texto, como redigir textos e e-mails.",
    thinking: "Pensando...",
    thoughtForAFewSeconds: "Pensou por alguns segundos",
    thoughtForPrefix: "Pensou por ",
    thoughtForSuffix: " segundos",
    viewChanges: "Ver alterações",
    viewNextVersion: "Ver próxima versão",
    viewPreviousVersion: "Ver versão anterior",
  },

  auth: {
    accountCreated: "Conta criada!",
    accountExists: "Esta conta já existe!",
    createAccount: "Criar conta",
    createFailed: "Não foi possível criar a conta!",
    email: "E-mail",
    emailPlaceholder: "voce@exemplo.com",
    getStarted: "Comece gratuitamente",
    haveAccount: "Já tem conta? ",
    invalidCredentials: "Credenciais inválidas!",
    noAccount: "Não tem conta? ",
    password: "Senha",
    signIn: "Entrar",
    signInContinue: "Entre na sua conta para continuar",
    signUp: "Criar conta",
    validationFailed: "Não foi possível validar o envio!",
    welcomeBack: "Bem-vindo de volta",
  },
  brand: {
    description:
      "Chat com inteligência artificial usando modelos econômicos — feito para o Brasil.",
    metadataBase: "https://bizu.chat",
    name: "Bizu",
    privacyUrl: "/privacidade",
    tagline: "Seu assistente de IA acessível",
    termsUrl: "/termos",
  },

  document: {
    addedSuggestions: "Sugestões adicionadas a",
    addingSuggestions: "Adicionando sugestões",
    sharedViewUnsupported:
      "Visualizar arquivos em chats compartilhados ainda não é suportado.",
  },

  errors: {
    badRequestApi:
      "Não foi possível processar a solicitação. Verifique os dados e tente de novo.",
    badRequestDocument:
      "A solicitação para criar ou atualizar o documento é inválida. Verifique os dados e tente novamente.",
    database: "Ocorreu um erro ao executar uma consulta no banco de dados.",
    forbiddenAuth: "Sua conta não tem acesso a este recurso.",
    forbiddenChat:
      "Este chat pertence a outro usuário. Verifique o ID e tente novamente.",
    forbiddenDocument:
      "Este documento pertence a outro usuário. Verifique o ID e tente novamente.",
    generic: "Algo deu errado. Tente novamente mais tarde.",
    notFoundChat: "Chat não encontrado. Verifique o ID e tente novamente.",
    notFoundDocument:
      "Documento não encontrado. Verifique o ID e tente novamente.",
    offlineChat:
      "Não estamos conseguindo enviar sua mensagem. Verifique a conexão e tente novamente.",
    rateLimitChat:
      "Você atingiu o limite de mensagens. Volte em 1 hora para continuar.",
    unauthorizedAuth: "Você precisa entrar antes de continuar.",
    unauthorizedChat:
      "Você precisa entrar para ver este chat. Entre e tente novamente.",
    unauthorizedDocument:
      "Você precisa entrar para ver este documento. Entre e tente novamente.",
    unavailable:
      "O Bizu está temporariamente indisponível. Já estamos trabalhando nisso — tente de novo em alguns minutos.",
  },

  greeting: {
    subtitle: "Pergunte algo, escreva código ou explore ideias.",
    title: "Bem-vindo ao Bizu!",
  },

  input: {
    askAnything: "Pergunte qualquer coisa...",
    available: "Disponível",
    deleteAll: "Excluir todos",
    deleteAllChats: "Excluir todos os chats?",
    deleteThisChat: "Excluir este chat?",
    editingMessage: "Editando mensagem",
    editMessage: "Edite sua mensagem...",
    pastedImage: "Imagem colada",
    pasteUploadFailed: "Falha ao enviar imagem(ns) colada(s)",
    renameFromSidebar:
      "Renomear está disponível no menu do chat na barra lateral.",
    searchModels: "Buscar modelos...",
    supportsReasoning: "Suporta raciocínio",
    supportsTools: "Suporta ferramentas",
    supportsVision: "Suporta visão",
    uploadFailed: "Falha no upload. Tente novamente!",
    uploadFilesFailed: "Falha ao enviar arquivos",
    waitForModel: "Aguarde o modelo terminar a resposta!",
  },

  legal: {
    privacy: "Privacidade",
    terms: "Termos",
  },

  message: {
    scrollToBottom: "Ir para o final",
    waiting: "Aguardando...",
  },

  sidebar: {
    allChatsDeleted: "Todos os chats foram excluídos",
    brandTooltip: "Bizu",
    cancel: "Cancelar",
    chatDeleted: "Chat excluído",
    deleteAll: "Excluir todos",
    deleteAllConfirm: "Excluir todos",
    deleteAllDescription:
      "Esta ação não pode ser desfeita. Todos os seus chats serão excluídos permanentemente.",
    deleteAllTitle: "Excluir todos os chats?",
    deleteAllTooltip: "Excluir todos os chats",
    deleteChatDescription:
      "Esta ação não pode ser desfeita. Este chat será excluído permanentemente.",
    deleteChatTitle: "Excluir chat?",
    deleteConfirm: "Excluir",
    emptyHistory:
      "Suas conversas aparecem aqui quando você começar a conversar!",
    history: "Histórico",
    last7Days: "Últimos 7 dias",
    last30Days: "Últimos 30 dias",
    loginToSave: "Entre para salvar e revisitar chats anteriores!",
    newChat: "Novo chat",
    newChatTooltip: "Novo chat",
    older: "Mais antigos",
    openSidebar: "Abrir barra lateral",
    today: "Hoje",
    yesterday: "Ontem",
  },

  slash: {
    clear: "Limpar o chat atual",
    commands: "Comandos",
    delete: "Excluir o chat atual",
    model: "Trocar o modelo de IA",
    new: "Iniciar um novo chat",
    purge: "Excluir todos os chats",
    rename: "Renomear o chat atual",
    theme: "Alternar tema claro/escuro",
  },

  userNav: {
    authChecking: "Verificando autenticação, tente de novo!",
    guest: "Convidado",
    loading: "Carregando...",
    loginAccount: "Entrar na sua conta",
    signOut: "Sair",
    toggleTheme: "Alternar tema",
  },

  visibility: {
    private: "Privado",
    privateDescription: "Só você pode acessar este chat",
    public: "Público",
    publicDescription: "Qualquer pessoa com o link pode acessar",
  },
} as const;

export type Messages = typeof messages;
