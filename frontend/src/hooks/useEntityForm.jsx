import { useEffect, useState } from 'react';
import { App } from 'antd';

/**
 * Hook générique de gestion de formulaire CRUD (Create / Update / Delete).
 *
 *
 * Fonctionnement :
 * - Si le champ `idField` est présent dans le formulaire, le hook passe en mode édition
 *   et charge les données correspondantes depuis l'API
 * - Sinon, le hook fonctionne en mode création
 *
 * Points d'extension :
 * - beforeSubmit : validation ou logique métier avant enregistrement
 * - afterSubmit  : action post-enregistrement (override du message par défaut)
 * - beforeDelete : confirmation ou contrôle avant suppression
 * - afterDelete  : action post-suppression
 * - onSuccess    : callback après create / update
 * - onDelete     : callback après suppression
 * - onDataLoaded : callback après le chargement des données en mode édition
 *
 * Comportement par défaut :
 * - Affiche des messages de succès / erreur standard
 * - Réinitialise le formulaire après suppression
 *
 * @param {Object} params
 * @param {Object} params.api           API CRUD (get, create, update, delete)
 * @param {FormInstance} params.form    Instance du formulaire Ant Design
 * @param {boolean} params.open         Indique si le formulaire est visible
 * @param {string} params.idField       Nom du champ identifiant (ex: "prt_id")
 * @param {Function} params.onDataLoaded Callback appelé après le chargement des données
 *
 * @returns {Object}
 * @returns {boolean} loading           Indique un traitement en cours
 * @returns {Object|null} entity        Entité chargée en mode édition
 * @returns {Function} submit           Création ou mise à jour de l'entité
 * @returns {Function} remove           Suppression de l'entité courante
 * @returns {Function} reload           Recharge les données depuis l'API
 */

export function useEntityForm({
    api,
    form,
    open,
    entityId,
    idField = 'id',

    transformData,
    beforeSubmit,
    afterSubmit,
    beforeDelete,
    afterDelete,

    onSuccess,
    onDelete,
    onDataLoaded,

    messages = {
        create: 'Ajout réalisé',
        update: 'Mise à jour réalisée',
        delete: 'Suppression réalisée avec succès',
        loadError: 'Erreur lors du chargement',
        saveError: "Erreur lors de l'enregistrement",
        deleteError: 'Erreur lors de la suppression',
    },
}) {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [entity, setEntity] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const [forbidden, setForbidden] = useState(false);

    /* =========================
       📥 Chargement des données
       ========================= */
    const loadData = async (showMessage = false) => {
        if (!entityId) {
            setLoadError(false);
            setForbidden(false);
            return;
        }

        setLoading(true);
        setLoadError(false);
        try {
            const response = await api.get(entityId);

            const data = transformData
                ? transformData(response.data)
                : response.data;

            setEntity(data);
            form?.setFieldsValue(data);

            // Appeler le callback onDataLoaded si fourni
            if (onDataLoaded) {
                onDataLoaded(data);
            }

            if (showMessage) {
                message.success('Données rechargées');
            }
        } catch (error) {
            const status = error.status;
            if (status === 403) {
                setForbidden(true);
                return;
            }
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open || !entityId) {
            setLoadError(false);
            return;
        }

        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, entityId]);

    /* =========================
       🔄 Rechargement manuel
       ========================= */
    const reload = async (showMessage = true) => {
        await loadData(showMessage);
    };

    /* =========================
       💾 Create / Update
       ========================= */
    const submit = async (values, options = {}) => {
        const { closeDrawer = true } = options;

        try {
            setLoading(true);

            if (beforeSubmit) {
                const result = await beforeSubmit(values);
                if (result === false) return;
            }

            const isUpdate = Boolean(values[idField]);
            const id = values[idField];

            const payload = { ...values };
            delete payload[idField];

            const response = isUpdate
                ? await api.update(id, payload)
                : await api.create(payload);

            const action = isUpdate ? 'update' : 'create';
            const result = { action, data: { ...response.data, id: response.data[idField] } };

            if (afterSubmit) {
                await afterSubmit(result);
            } else {
                message.success(messages[action]);
            }

            if (onSuccess) {
                onSuccess(result, closeDrawer);
            }

            return result;
        } catch (error) {
            const code = error.status
            const table = error.table;
            if (code === 1451 || code === 23000) {
                message.error(
                    table
                        ? `Impossible de supprimer cet enregistrement : il est utilisé dans la table "${table}".`
                        : "Impossible de supprimer cet enregistrement : il est lié à d'autres données."
                );
            } else if (code === 422) {
                const messages = error.message;
                if (messages) {
                    // On récupère les valeurs
                    const allMessages = typeof messages === 'string'
                        ? messages
                        : Object.values(messages ?? {}).flat().join(' | ');
                    message.error(allMessages);
                } else {
                    message.error("Erreur de validation inconnue.");
                }

            } else {
                message.error(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    /* =========================
       🗑️ Suppression
       ========================= */
    const remove = async () => {
        if (!entity || !entity[idField]) {
            message.warning('Aucun item sélectionné');
            return;
        }

        try {
            if (beforeDelete) {
                const ok = await beforeDelete(entity);
                if (ok === false) return;
            }

            setLoading(true);
            await api.delete(entity[idField]);

            if (afterDelete) {
                afterDelete(entity);
            } else {
                message.success(messages.delete);
            }

            if (onDelete) {
                onDelete({ action: 'delete', id: entity[idField] });
            }

            form?.resetFields();
            setEntity(null);
        } catch (error) {
            const code = error.data?.code;
            const table = error.data?.table;
            if (code === 1451 || code === 23000) {
                message.error(
                    table
                        ? `Impossible de supprimer cet enregistrement : il est utilisé dans la table "${table}".`
                        : "Impossible de supprimer cet enregistrement : il est lié à d'autres données."
                );
            } else {              
                message.error(error.message || messages.deleteError);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        forbidden,
        entity,
        submit,
        remove,
        reload,
        loadError,
    };
}