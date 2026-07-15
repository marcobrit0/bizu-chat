import type { Metadata } from "next";

export const metadata: Metadata = {
  // Unreviewed legal draft — keep it out of search results until a lawyer signs off.
  robots: { index: false },
  title: "Termos de Uso · Bizu",
};

export default function TermosPage() {
  return (
    <>
      <h1>Termos de Uso</h1>
      <p>
        <em>Última atualização: [DATA_DE_VIGÊNCIA]</em>
      </p>

      <h2>1. Aceitação</h2>
      <p>
        Ao criar uma conta ou usar o Bizu, você concorda com estes Termos. Se
        não concordar, não utilize o serviço.
      </p>

      <h2>2. O que é o Bizu</h2>
      <p>
        O Bizu é um assistente de conversa baseado em modelos de inteligência
        artificial. O serviço é fornecido por [RAZÃO_SOCIAL], CNPJ [CNPJ].
      </p>

      <h2>3. Sua conta</h2>
      <p>
        Você deve ter ao menos 18 anos, ou 13 anos com consentimento dos
        responsáveis. Você é responsável por manter sua senha em sigilo e por
        toda atividade realizada na sua conta.
      </p>

      <h2>4. Uso aceitável</h2>
      <p>Você concorda em não utilizar o Bizu para:</p>
      <ul>
        <li>praticar atos ilícitos ou violar direitos de terceiros;</li>
        <li>
          gerar conteúdo que explore ou coloque em risco menores de idade;
        </li>
        <li>produzir desinformação, spam ou conteúdo fraudulento;</li>
        <li>
          tentar contornar limites de uso, medidas de segurança ou realizar
          engenharia reversa do serviço.
        </li>
      </ul>

      <h2>5. Conteúdo gerado por IA</h2>
      <p>
        As respostas são geradas automaticamente e{" "}
        <strong>
          podem conter erros, imprecisões ou informações desatualizadas
        </strong>
        . Elas não constituem aconselhamento médico, jurídico ou financeiro.
        Confira informações importantes antes de agir com base nelas.
      </p>

      <h2>6. Planos e pagamento</h2>
      <p>
        O plano gratuito possui limites de uso. O plano pago é cobrado
        mensalmente em reais (R$), com renovação automática até o cancelamento.
        Você pode cancelar a qualquer momento e manterá o acesso até o fim do
        período já pago. [REVISAR_COM_ADVOGADO: direito de arrependimento de 7
        dias — art. 49 do Código de Defesa do Consumidor — e política de
        reembolso.]
      </p>

      <h2>7. Encerramento</h2>
      <p>
        Você pode excluir sua conta quando quiser. Podemos suspender contas que
        violem estes Termos.
      </p>

      <h2>8. Limitação de responsabilidade</h2>
      <p>
        [REVISAR_COM_ADVOGADO: cláusula de limitação de responsabilidade. O
        Código de Defesa do Consumidor restringe fortemente limitações em
        relações de consumo no Brasil — esta seção não deve ser copiada de
        modelos norte-americanos.]
      </p>

      <h2>9. Lei aplicável</h2>
      <p>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do
        domicílio do consumidor para dirimir controvérsias, nos termos do Código
        de Defesa do Consumidor.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas: <a href="mailto:[EMAIL_DE_CONTATO]">[EMAIL_DE_CONTATO]</a>.
      </p>
    </>
  );
}
