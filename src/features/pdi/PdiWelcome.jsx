import React from 'react';

// Tela inicial do PDI quando o doc está vazio (post-wipe ou first boot).
// 3 caminhos:
//   - Começar meu PDI: carrega template focado em estudos + abre setup com rotina
//   - Ver exemplo (tutorial): carrega o seed tutorial completo
//   - Em branco: doc vazio + abre setup (modo edição)

function PdiWelcome({ onStart, onTutorial, onBlank, onBack }) {
  return (
    <div className="pdi-welcome">
      {onBack ? (
        <button type="button" className="pdi-view__back pdi-welcome__back" onClick={onBack}>
          <i className="fa-solid fa-arrow-left"></i>
          Voltar
        </button>
      ) : null}

      <div className="pdi-welcome__inner">
        <div className="pdi-welcome__icon" aria-hidden="true">📚</div>
        <h1 className="pdi-welcome__title">Bem-vindo ao seu PDI</h1>
        <p className="pdi-welcome__subtitle">
          Um sistema simples pra organizar seus estudos: metas, hábitos com lembrete,
          cursos vinculados à Alura, e o que mais você quiser anotar.
        </p>

        <div className="pdi-welcome__cards">
          <button
            type="button"
            className="pdi-welcome__card pdi-welcome__card--primary"
            onClick={onStart}
          >
            <div className="pdi-welcome__card-icon">🚀</div>
            <div className="pdi-welcome__card-main">
              <strong>Começar meu PDI</strong>
              <span>
                Cria a estrutura básica de estudos (objetivos, cursos, rotina, anotações)
                e abre a configuração com horário e lembrete.
              </span>
            </div>
            <i className="fa-solid fa-arrow-right pdi-welcome__card-arrow"></i>
          </button>

          <button
            type="button"
            className="pdi-welcome__card"
            onClick={onTutorial}
          >
            <div className="pdi-welcome__card-icon">📖</div>
            <div className="pdi-welcome__card-main">
              <strong>Ver exemplo (tutorial)</strong>
              <span>
                Carrega um PDI de exemplo com todos os tipos de bloco explicados
                — bom pra conhecer as possibilidades antes de começar o seu.
              </span>
            </div>
            <i className="fa-solid fa-arrow-right pdi-welcome__card-arrow"></i>
          </button>
        </div>

        <button type="button" className="pdi-welcome__blank" onClick={onBlank}>
          Prefiro começar do zero, em branco
        </button>
      </div>
    </div>
  );
}

export default PdiWelcome;
