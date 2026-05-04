import React from 'react';
import { useNavigate } from 'react-router-dom';

function AllocationView() {
  const navigate = useNavigate();

  return (
    <main className="allocation-view">
      <div className="allocation-view__inner">
        <button
          type="button"
          className="allocation-view__back"
          onClick={() => navigate(-1)}
        >
          <i className="fa-solid fa-arrow-left"></i>
          Voltar
        </button>

        <div className="allocation-view__card">
          <div className="allocation-view__icon" aria-hidden="true">
            <i className="fa-solid fa-helmet-safety"></i>
          </div>
          <h1 className="allocation-view__title">Em construção</h1>
          <p className="allocation-view__lede">
            Esse painel ainda está sendo desenhado com o time.
          </p>
        </div>
      </div>
    </main>
  );
}

export default AllocationView;
