import { message } from '../utils/antdStatic';
/**
 * Hook réutilisable pour gérer les clics sur les lignes 
 *
 * @param {function} openForEdit - Fonction à appeler pour ouvrir l'édition
 * @param {string} idField - Nom du champ contenant l'ID (par défaut: "id")
 */
export function useRowHandler(openForEdit, idField = "id") {
  const handleRowClick = async (row) => {
    try {
      openForEdit(row[idField]);
    } catch (error) {
      console.error("Erreur lors du chargement :", error);
      message.error("Erreur lors du chargement");
    }
  };

  return { handleRowClick };
}