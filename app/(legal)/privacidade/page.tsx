import type { Metadata } from "next";

export const metadata: Metadata = {
  // Unreviewed legal draft — keep it out of search results until a lawyer signs off.
  robots: { index: false },
  title: "Política de Privacidade · Bizu",
};

export default function PrivacidadePage() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p>
        <em>Última atualização: [DATA_DE_VIGÊNCIA]</em>
      </p>

      <h2>1. Quem somos</h2>
      <p>
        O Bizu é operado por [RAZÃO_SOCIAL], inscrita no CNPJ sob o nº [CNPJ],
        com sede em [ENDEREÇO_COMPLETO]. Para os fins da Lei Geral de Proteção
        de Dados (Lei nº 13.709/2018), somos o <strong>controlador</strong> dos
        seus dados pessoais.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li>
          <strong>Dados de cadastro:</strong> seu endereço de e-mail e uma senha
          criptografada.
        </li>
        <li>
          <strong>Conteúdo das conversas:</strong> as mensagens que você envia e
          as respostas geradas, para que seu histórico funcione.
        </li>
        <li>
          <strong>Arquivos enviados:</strong> imagens que você anexa às
          conversas.
        </li>
        <li>
          <strong>Dados de uso:</strong> endereço IP e registros de acesso,
          mantidos por 6 (seis) meses conforme o art. 15 do Marco Civil da
          Internet (Lei nº 12.965/2014).
        </li>
        <li>
          <strong>Dados de pagamento:</strong> processados pela Stripe. Não
          armazenamos os dados do seu cartão.
        </li>
      </ul>

      <h2>3. Por que tratamos seus dados</h2>
      <p>
        Tratamos seus dados para executar o contrato de prestação do serviço
        (art. 7º, V da LGPD), para cumprir obrigações legais (art. 7º, II) e,
        quando aplicável, mediante o seu consentimento (art. 7º, I).
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <p>
        Para gerar as respostas, o conteúdo das suas conversas é enviado a
        provedores de modelos de inteligência artificial, que podem estar
        localizados fora do Brasil. Isso caracteriza transferência internacional
        de dados nos termos do art. 33 da LGPD. Também utilizamos provedores de
        infraestrutura e de pagamento. [REVISAR_COM_ADVOGADO: listar os
        provedores e a base legal da transferência internacional.]
      </p>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Mantemos seus dados enquanto sua conta existir. Ao excluir sua conta,
        removemos seus dados pessoais, ressalvados os registros de acesso, que a
        lei exige que sejam mantidos por 6 (seis) meses.
      </p>

      <h2>6. Seus direitos</h2>
      <p>
        Nos termos do art. 18 da LGPD, você pode solicitar a confirmação de
        tratamento, o acesso, a correção, a anonimização, a portabilidade e a
        exclusão dos seus dados, bem como revogar o consentimento. Para exercer
        qualquer um desses direitos, escreva para{" "}
        <a href="mailto:[EMAIL_DE_PRIVACIDADE]">[EMAIL_DE_PRIVACIDADE]</a>.
        Responderemos no prazo legal.
      </p>

      <h2>7. Encarregado (DPO)</h2>
      <p>
        Encarregado pelo tratamento de dados pessoais: [NOME_DO_ENCARREGADO] —{" "}
        <a href="mailto:[EMAIL_DO_ENCARREGADO]">[EMAIL_DO_ENCARREGADO]</a>.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Adotamos medidas técnicas e administrativas para proteger seus dados.
        Nenhum sistema é totalmente seguro; em caso de incidente relevante,
        comunicaremos você e a ANPD conforme o art. 48 da LGPD.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Podemos atualizar esta política. Mudanças relevantes serão comunicadas
        por e-mail ou dentro do próprio serviço.
      </p>
    </>
  );
}
