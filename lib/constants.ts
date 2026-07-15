import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const DUMMY_PASSWORD = generateDummyPassword();

export const suggestions = [
  "Escreva um e-mail profissional pedindo aumento de salário",
  "Explique o que é CDB e Tesouro Direto para quem nunca investiu",
  "Crie um plano de treino de 3 dias por semana para iniciantes",
  "Resuma este texto em 5 tópicos e me diga o que é mais importante",
];
