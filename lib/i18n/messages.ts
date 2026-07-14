/**
 * Bizu product copy — Portuguese (Brazil).
 * Single source of truth for user-facing strings (no bilingual routing in MVP).
 */
export const messages = {
  brand: {
    name: "Bizu",
    tagline: "Seu assistente de IA acessível",
    description:
      "Chat com inteligência artificial usando modelos econômicos — feito para o Brasil.",
    metadataBase: "https://bizu.chat",
    privacyUrl: "https://bizu.chat/privacidade",
    termsUrl: "https://bizu.chat/termos",
  },

  greeting: {
    title: "Bem-vindo ao Bizu!",
    subtitle: "Pergunte algo, escreva código ou explore ideias.",
  },

  auth: {
    email: "E-mail",
    password: "Senha",
    emailPlaceholder: "voce@exemplo.com",
    welcomeBack: "Bem-vindo de volta",
    signInContinue: "Entre na sua conta para continuar",
    signIn: "Entrar",
    noAccount: "Não tem conta? ",
    signUp: "Criar conta",
    createAccount: "Criar conta",
    getStarted: "Comece gratuitamente",
    haveAccount: "Já tem conta? ",
    invalidCredentials: "Credenciais inválidas!",
    validationFailed: "Não foi possível validar o envio!",
    accountExists: "Esta conta já existe!",
    createFailed: "Não foi possível criar a conta!",
    accountCreated: "Conta criada!",
  },

  sidebar: {
    brandTooltip: "Bizu",
    openSidebar: "Abrir barra lateral",
    newChat: "Novo chat",
    newChatTooltip: "Novo chat",
    deleteAll: "Excluir todos",
    deleteAllTooltip: "Excluir todos os chats",
    deleteAllTitle: "Excluir todos os chats?",
    deleteAllDescription:
      "Esta ação não pode ser desfeita. Todos os seus chats serão excluídos permanentemente.",
    cancel: "Cancelar",
    deleteAllConfirm: "Excluir todos",
    allChatsDeleted: "Todos os chats foram excluídos",
    history: "Histórico",
    today: "Hoje",
    yesterday: "Ontem",
    last7Days: "Últimos 7 dias",
    last30Days: "Últimos 30 dias",
    older: "Mais antigos",
    chatDeleted: "Chat excluído",
    deleteChatTitle: "Excluir chat?",
    deleteChatDescription:
      "Esta ação não pode ser desfeita. Este chat será excluído permanentemente.",
    deleteConfirm: "Excluir",
    loginToSave: "Entre para salvar e revisitar chats anteriores!",
    emptyHistory: "Suas conversas aparecem aqui quando você começar a conversar!",
  },

  userNav: {
    loading: "Carregando...",
    guest: "Convidado",
    loginAccount: "Entrar na sua conta",
    signOut: "Sair",
    toggleTheme: "Alternar tema",
    authChecking: "Verificando autenticação, tente de novo!",
  },

  input: {
    askAnything: "Pergunte qualquer coisa...",
    editMessage: "Edite sua mensagem...",
    searchModels: "Buscar modelos...",
    supportsTools: "Suporta ferramentas",
    supportsVision: "Suporta visão",
    supportsReasoning: "Suporta raciocínio",
    available: "Disponível",
    uploadFailed: "Falha no upload. Tente novamente!",
    uploadFilesFailed: "Falha ao enviar arquivos",
    pastedImage: "Imagem colada",
    pasteUploadFailed: "Falha ao enviar imagem(ns) colada(s)",
    waitForModel: "Aguarde o modelo terminar a resposta!",
    renameFromSidebar: "Renomear está disponível no menu do chat na barra lateral.",
    deleteThisChat: "Excluir este chat?",
    deleteAllChats: "Excluir todos os chats?",
    deleteAll: "Excluir todos",
  },

  visibility: {
    private: "Privado",
    privateDescription: "Só você pode acessar este chat",
    public: "Público",
    publicDescription: "Qualquer pessoa com o link pode acessar",
  },

  slash: {
    commands: "Comandos",
    new: "Iniciar um novo chat",
    clear: "Limpar o chat atual",
    rename: "Renomear o chat atual",
    model: "Trocar o modelo de IA",
    theme: "Alternar tema claro/escuro",
    delete: "Excluir o chat atual",
    purge: "Excluir todos os chats",
  },

  message: {
    waiting: "Aguardando...",
    scrollToBottom: "Ir para o final",
  },

  document: {
    addingSuggestions: "Adicionando sugestões",
    addedSuggestions: "Sugestões adicionadas a",
    sharedViewUnsupported:
      "Visualizar arquivos em chats compartilhados ainda não é suportado.",
  },

  errors: {
    generic: "Algo deu errado. Tente novamente mais tarde.",
    database: "Ocorreu um erro ao executar uma consulta no banco de dados.",
    badRequestApi:
      "Não foi possível processar a solicitação. Verifique os dados e tente de novo.",
    activateGateway:
      "O AI Gateway exige um cartão de crédito válido para atender solicitações. Adicione um cartão em https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card para liberar seus créditos gratuitos.",
    unauthorizedAuth: "Você precisa entrar antes de continuar.",
    forbiddenAuth: "Sua conta não tem acesso a este recurso.",
    rateLimitChat:
      "Você atingiu o limite de mensagens. Volte em 1 hora para continuar.",
    notFoundChat:
      "Chat não encontrado. Verifique o ID e tente novamente.",
    forbiddenChat:
      "Este chat pertence a outro usuário. Verifique o ID e tente novamente.",
    unauthorizedChat:
      "Você precisa entrar para ver este chat. Entre e tente novamente.",
    offlineChat:
      "Não estamos conseguindo enviar sua mensagem. Verifique a conexão e tente novamente.",
    notFoundDocument:
      "Documento não encontrado. Verifique o ID e tente novamente.",
    forbiddenDocument:
      "Este documento pertence a outro usuário. Verifique o ID e tente novamente.",
    unauthorizedDocument:
      "Você precisa entrar para ver este documento. Entre e tente novamente.",
    badRequestDocument:
      "A solicitação para criar ou atualizar o documento é inválida. Verifique os dados e tente novamente.",
  },


  actions: {
    copied: "Copiado!",
    upvoteFailed: "Falha ao curtir a resposta.",
    downvoteFailed: "Falha ao descurtir a resposta.",
    submitLoading: "Carregando",
    submitForm: "Enviar formulário",
    actionFailed: "Falha ao executar a ação",
    modelUnavailableDemo: "Este modelo não está disponível no demo.",
  },

  legal: {
    privacy: "Privacidade",
    terms: "Termos",
  },
} as const;

export type Messages = typeof messages;
