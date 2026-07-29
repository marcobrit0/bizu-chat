/**
 * Bizu product copy — Portuguese (Brazil).
 * Single source of truth for user-facing strings (no bilingual routing in MVP).
 */
export const messages = {
  actions: {
    actionFailed: "Falha ao executar a ação",
    copied: "Copiado!",
    downvoteFailed: "Falha ao descurtir a resposta.",
    modelUnavailableDemo: "Este modelo não está disponível no demo.",
    submitForm: "Enviar formulário",
    submitLoading: "Carregando",
    upvoteFailed: "Falha ao curtir a resposta.",
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
    privacyUrl: "https://bizu.chat/privacidade",
    tagline: "Seu assistente de IA acessível",
    termsUrl: "https://bizu.chat/termos",
  },

  document: {
    addedSuggestions: "Sugestões adicionadas a",
    addingSuggestions: "Adicionando sugestões",
    sharedViewUnsupported:
      "Visualizar arquivos em chats compartilhados ainda não é suportado.",
  },

  errors: {
    activateGateway:
      "O AI Gateway exige um cartão de crédito válido para atender solicitações. Adicione um cartão em https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card para liberar seus créditos gratuitos.",
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
    deleteAccount: "Excluir conta e dados",
    deleteAccountConfirm: "Excluir permanentemente",
    deleteAccountDescription:
      "Esta ação exclui permanentemente sua conta, chats, mensagens, documentos, sugestões e arquivos enviados.",
    deleteAccountFailed:
      "Não foi possível concluir a exclusão da conta. Tente novamente.",
    deleteAccountTitle: "Excluir sua conta e todos os dados?",
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
