export function About() {
  return (
    <article className="about-view">
      <p className="eyebrow">Sobre o projeto</p>
      <h1>Uma forma simples de acompanhar o Metro.</h1>
      <p>
        Metro Lisboa Live reúne as previsões de chegada e o estado de circulação
        das quatro linhas do Metro de Lisboa.
      </p>
      <p>
        As posições dos comboios no mapa e na lista de estações são estimativas
        calculadas a partir dos tempos de chegada. Não representam posições
        medidas por GPS. A animação para quando deixa de haver observações
        atuais.
      </p>
      <p>
        O mapa da rede mantém o desenho e as cores oficiais. As previsões e
        mensagens de circulação são fornecidas pelo Metropolitano de Lisboa;
        este é um projeto independente.
      </p>
      <p>
        A localização das estações usa{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
        . Os horários correspondem à exploração normal; consulte os avisos do
        operador em caso de greve ou perturbação.
      </p>
      <p>
        <a href="https://www.metrolisboa.pt/" target="_blank" rel="noreferrer">
          Consultar o site oficial do Metro ↗
        </a>
      </p>
    </article>
  );
}
