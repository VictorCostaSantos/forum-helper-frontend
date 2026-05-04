import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { fetchAvatarFromBackend } from '../../api/apiService';
import { useToast } from '../../shared/ui/ToastProvider';
import { db } from './firebase';
import {
  TYPE_COLORS,
  TEAM_MEMBERS,
  FILTERS_LEFT,
  FILTERS_RIGHT,
  initialForm,
  markAsRead,
  getPinnedCards,
  savePinned,
  togglePin,
  getPrivateCards,
  savePrivateCards,
} from './helpers';
import CardItem from './components/CardItem';
import FormModal from './components/FormModal';
import ViewModal from './components/ViewModal';

function MuralView({ username }) {
  const { showToast } = useToast();
  const [cards, setCards] = useState([]);
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [openModal, setOpenModal] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [viewedCard, setViewedCard] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [teamAvatars, setTeamAvatars] = useState({});
  const [, forceTick] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'mural_cards'),
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setCards(list);
      },
      (err) => console.error('Firestore listener:', err)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all(
      TEAM_MEMBERS.map(async (m) => {
        const av = await fetchAvatarFromBackend(m);
        return [m, av.success ? av.url : `https://ui-avatars.com/api/?name=${m}`];
      })
    ).then((entries) => {
      if (alive) setTeamAvatars(Object.fromEntries(entries));
    });
    return () => { alive = false; };
  }, []);

  const allCards = useMemo(() => {
    const privateCards = getPrivateCards(username);
    return [...privateCards, ...cards];
  }, [cards, username]);

  const cardMatchesFilter = useCallback(
    (card) => {
      const af = activeFilters;
      const noFilter = af.size === 0;
      const LEFT = new Set(['mine', 'created', 'private', 'archived']);
      const typeFilters = [...af].filter((f) => !LEFT.has(f));

      if (af.has('archived')) {
        if (!card.isArchived) return false;
      } else if (card.isArchived) {
        return false;
      }

      if (card.isPrivate) {
        if (noFilter) return true;
        if (af.has('private')) return typeFilters.length === 0 || typeFilters.includes(card.type);
        return false;
      }

      if (noFilter) return true;
      if (typeFilters.length > 0 && !typeFilters.includes(card.type)) return false;
      if (af.has('private')) return false;
      if (af.has('archived')) return true;
      if (af.has('mine') && !(card.assignees || []).includes(username)) return false;
      if (af.has('created') && card.createdBy !== username) return false;
      return true;
    },
    [activeFilters, username]
  );

  const visibleCards = useMemo(() => {
    const pinnedSet = getPinnedCards();
    const filtered = allCards.filter(cardMatchesFilter);
    return filtered.sort((a, b) => {
      const aP = pinnedSet.has(a.id);
      const bP = pinnedSet.has(b.id);
      if (aP && !bP) return -1;
      if (!aP && bP) return 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [allCards, cardMatchesFilter]);

  const toggleFilter = (filter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (filter === 'all') return new Set();
      const LEFT = new Set(['mine', 'created', 'private', 'archived']);
      const RIGHT = new Set(['Aviso', 'Demanda', 'Link Útil', 'Projeto', 'Reunião']);
      const group = LEFT.has(filter) ? LEFT : RIGHT.has(filter) ? RIGHT : null;

      if (next.has(filter)) {
        next.delete(filter);
      } else {
        if (group) {
          group.forEach((other) => { if (next.has(other)) next.delete(other); });
        }
        next.add(filter);
      }
      return next;
    });
  };

  const openCreate = () => {
    setForm(initialForm);
    setOpenModal('create');
  };

  const openEdit = (card) => {
    setForm({
      id: card.id,
      title: card.title || '',
      type: card.type || 'Aviso',
      description: card.description || '',
      link: card.link || '',
      endDate: card.endDate || '',
      visibilityAll: !!card.visibilityAll,
      isPrivate: !!card.isPrivate,
      assignees: card.assignees || [],
    });
    setOpenModal('edit');
  };

  const closeModal = () => {
    setOpenModal(null);
    setForm(initialForm);
  };

  const handleAssigneesAll = (checked) => {
    setForm((prev) => ({
      ...prev,
      visibilityAll: checked,
      assignees: checked ? [...TEAM_MEMBERS] : [],
    }));
  };

  const handlePrivateToggle = (checked) => {
    setForm((prev) => ({
      ...prev,
      isPrivate: checked,
      visibilityAll: checked ? false : prev.visibilityAll,
      assignees: checked ? [username].filter(Boolean) : prev.assignees,
    }));
  };

  const toggleAssignee = (member) => {
    setForm((prev) => ({
      ...prev,
      assignees: prev.assignees.includes(member)
        ? prev.assignees.filter((m) => m !== member)
        : [...prev.assignees, member],
    }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Adicione um título.', 'error');
      return;
    }
    setSubmitting(true);
    const cardData = {
      title: form.title.trim(),
      type: form.type,
      color: TYPE_COLORS[form.type] || TYPE_COLORS['Outros'],
      description: form.description.trim(),
      link: form.link.trim(),
      endDate: form.endDate,
      assignees: form.assignees,
      visibilityAll: form.visibilityAll,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (form.isPrivate && !form.id) {
        const card = {
          ...cardData,
          id: `priv_${Date.now()}`,
          isPrivate: true,
          createdBy: username,
          createdAt: new Date().toISOString(),
        };
        const stored = getPrivateCards(username);
        savePrivateCards(username, [card, ...stored]);
        showToast('Card privado criado!', 'success');
      } else if (form.id && form.id.startsWith('priv_')) {
        const stored = getPrivateCards(username).map((c) => (c.id === form.id ? { ...c, ...cardData } : c));
        savePrivateCards(username, stored);
        showToast('Card privado atualizado!', 'success');
      } else if (form.id) {
        await updateDoc(doc(db, 'mural_cards', form.id), cardData);
        showToast('Card atualizado!', 'success');
      } else {
        await addDoc(collection(db, 'mural_cards'), {
          ...cardData,
          createdBy: username,
          createdAt: new Date().toISOString(),
        });
        showToast('Card criado!', 'success');
      }
      closeModal();
      forceTick((x) => x + 1);
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (card, archived) => {
    if (card.isPrivate) {
      const stored = getPrivateCards(username).map((c) => (c.id === card.id ? { ...c, isArchived: archived } : c));
      savePrivateCards(username, stored);
      forceTick((x) => x + 1);
    } else {
      await updateDoc(doc(db, 'mural_cards', card.id), { isArchived: archived });
    }
    showToast(archived ? 'Card arquivado.' : 'Card restaurado!', 'success');
  };

  const handleDelete = async (card) => {
    if (!window.confirm('Excluir definitivamente?')) return;
    const pinned = getPinnedCards();
    if (pinned.has(card.id)) { pinned.delete(card.id); savePinned(pinned); }
    if (card.isPrivate) {
      const stored = getPrivateCards(username).filter((c) => c.id !== card.id);
      savePrivateCards(username, stored);
      forceTick((x) => x + 1);
    } else {
      await deleteDoc(doc(db, 'mural_cards', card.id));
    }
    showToast('Card excluído.', 'success');
    setViewedCard(null);
    setOpenModal(null);
  };

  const handleTogglePin = (cardId) => {
    const nowPinned = togglePin(cardId);
    showToast(nowPinned ? 'Fixado no topo!' : 'Removido dos fixados.', 'success');
    forceTick((x) => x + 1);
  };

  const openView = (card) => {
    if (markAsRead(card.id)) forceTick((x) => x + 1);
    setViewedCard(card);
    setOpenModal('view');
  };

  const pinnedSet = getPinnedCards();

  return (
    <div id="mural-view" className="view-container active">
      <main>
        <div className="mural-wrapper content-wrapper">
          <div className="mural-header-compact">
            <div className="mural-title-block">
              <h2><i className="fas fa-columns" style={{ color: 'var(--cor-ia)' }}></i> Mural</h2>
            </div>

            <div className="mural-filters-bar">
              {FILTERS_LEFT.map((f) => {
                const isActive = f.value === 'all' ? activeFilters.size === 0 : activeFilters.has(f.value);
                return (
                  <button
                    key={f.value}
                    className={`mural-filter-chip ${isActive ? 'active' : ''}`}
                    data-filter={f.value}
                    onClick={() => toggleFilter(f.value)}
                  >
                    <i className={`fas ${f.icon}`}></i> {f.label}
                  </button>
                );
              })}
              <div className="mural-filters-separator"></div>
              {FILTERS_RIGHT.map((f) => (
                <button
                  key={f.value}
                  className={`mural-filter-chip ${activeFilters.has(f.value) ? 'active' : ''}`}
                  data-filter={f.value}
                  onClick={() => toggleFilter(f.value)}
                >
                  <i className={`fas ${f.icon}`}></i> {f.value}
                </button>
              ))}
            </div>

            <button id="btn-open-mural-modal" className="btn-mural-create" onClick={openCreate}>
              <i className="fas fa-plus"></i> Novo Card
            </button>
          </div>

          <div id="mural-board" className="mural-masonry-grid">
            {visibleCards.length === 0 ? (
              <div className="mural-empty-state">
                <i className="fas fa-inbox"></i>
                <p>Nenhum card para exibir aqui.</p>
              </div>
            ) : (
              visibleCards.map((card) => (
                <CardItem
                  key={card.id}
                  card={card}
                  isOwner={card.createdBy === username || card.isPrivate}
                  isPinned={pinnedSet.has(card.id)}
                  onView={() => openView(card)}
                  onEdit={() => openEdit(card)}
                  onArchive={(archived) => handleArchive(card, archived)}
                  onDelete={() => handleDelete(card)}
                  onPin={() => handleTogglePin(card.id)}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {(openModal === 'create' || openModal === 'edit') && (
        <FormModal
          form={form}
          setForm={setForm}
          submitting={submitting}
          onSubmit={submitForm}
          onClose={closeModal}
          isEdit={openModal === 'edit'}
          handleAssigneesAll={handleAssigneesAll}
          handlePrivateToggle={handlePrivateToggle}
          toggleAssignee={toggleAssignee}
          teamAvatars={teamAvatars}
        />
      )}

      {openModal === 'view' && viewedCard && (
        <ViewModal
          card={viewedCard}
          isOwner={viewedCard.createdBy === username || viewedCard.isPrivate}
          isPinned={getPinnedCards().has(viewedCard.id)}
          onClose={() => { setOpenModal(null); setViewedCard(null); }}
          onEdit={() => openEdit(viewedCard)}
          onDelete={() => handleDelete(viewedCard)}
          onPin={() => handleTogglePin(viewedCard.id)}
          teamAvatars={teamAvatars}
        />
      )}
    </div>
  );
}

export default MuralView;
