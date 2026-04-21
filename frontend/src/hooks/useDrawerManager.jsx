import { useState } from 'react';

/**
 * Hook réutilisable pour gérer l'état d'un drawer
 * Utilisé dans toutes les pages de type liste
 */
export function useDrawerManager() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const openDrawer = (id = null) => {
    setSelectedItemId(id);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedItemId(null);
  };

  const openForCreate = () => openDrawer(null);
  const openForEdit = (id) => openDrawer(id);

  return {
    drawerOpen,
    selectedItemId,
    openDrawer,
    closeDrawer,
    openForCreate,
    openForEdit
  };
}