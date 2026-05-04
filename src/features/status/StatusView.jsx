import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusPanel from '../../shared/components/StatusPanel';

function StatusView({ username }) {
  const navigate = useNavigate();

  return (
    <main className="status-view">
      <div className="status-view__inner">
        <button
          type="button"
          className="status-view__back"
          onClick={() => navigate(-1)}
        >
          <i className="fa-solid fa-arrow-left"></i>
          Voltar
        </button>

        <div className="status-view__head">
          <h1 className="status-view__title">
            <i className="fa-solid fa-stethoscope"></i>
            Status do sistema
          </h1>
          <p className="status-view__subtitle">
            Verifica em tempo real se as fontes de dados (tópicos, stats, planilhas)
            estão respondendo. Cada bullet acende verde quando OK e vermelho se falhar.
          </p>
        </div>

        <div className="status-view__body">
          <StatusPanel username={username} />
        </div>
      </div>
    </main>
  );
}

export default StatusView;
