import { useState, useEffect, useRef } from "react";
import { Drawer, Button, Alert, Progress, Card, Checkbox, Modal, Flex, Descriptions, Popconfirm, Space } from "antd";
import { message } from '../../utils/antdStatic';
import { CheckCircleOutlined, LoadingOutlined, ClockCircleOutlined, CloseCircleOutlined, DownloadOutlined, DeleteOutlined } from "@ant-design/icons";
import { accountingClosuresApi } from "../../services/api";
import { formatDate } from "../../utils/formatters";
import { usePermission } from "../../hooks/usePermission";
import CanAccess from "../../components/common/CanAccess";

/**
 * Drawer pour gérer une clôture comptable
 */
export default function AccountingClosure({ closureId, open, onClose, onSubmit, drawerSize = "large" }) {
    const { can } = usePermission();
    const [loading, setLoading] = useState(false);
    const [currentExercise, setCurrentExercise] = useState(null);
    const [closure, setClosure] = useState(null);
    const [processStatus, setProcessStatus] = useState(null);
    const [openExercise, setOpenExercise] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [workerStatus, setWorkerStatus] = useState({ available: null, message: '', checking: false });

    const pollIntervalRef = useRef(null);
    const processIdRef = useRef(null);

    // Charger les données au montage
    useEffect(() => {
        if (open) {
            if (closureId) {
                loadClosure();
            } else {
                loadCurrentExercise();
                checkWorkerStatus();
            }
        }

        // Nettoyage au démontage
        return () => {
            stopPolling();
        };
    }, [open, closureId]);

    const checkWorkerStatus = async () => {
        setWorkerStatus(prev => ({ ...prev, checking: true }));
        try {
            const response = await accountingClosuresApi.checkWorkerStatus();
            setWorkerStatus({
                available: response.available,
                message: response.message,
                checking: false
            });
        } catch (error) {
            setWorkerStatus({
                available: false,
                message: "Impossible de vérifier le statut du worker",
                checking: false
            });
        }
    };

    // Arrêter le polling quand le drawer se ferme
    useEffect(() => {
        if (!open) {
            stopPolling();
        }
    }, [open]);

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    const loadCurrentExercise = async () => {
        setLoading(true);
        try {
            const response = await accountingClosuresApi.getCurrentExercise();
            setCurrentExercise(response.data);
        } catch (error) {
            message.error("Erreur lors du chargement de l'exercice: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadClosure = async () => {
        setLoading(true);
        try {
            const response = await accountingClosuresApi.get(closureId);
            setClosure(response.data);
        } catch (error) {
            message.error("Erreur lors du chargement de la clôture: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStartClosure = () => {
        const isClosed = currentExercise?.is_closed;

        Modal.confirm({
            title: isClosed ? "Ouverture d'exercice" : "Confirmation de clôture",
            content: isClosed
                ? "Êtes-vous sûr de vouloir ouvrir un nouvel exercice comptable ?"
                : (openExercise
                    ? "Êtes-vous sûr de vouloir clôturer l'exercice et ouvrir le suivant ?"
                    : "Êtes-vous sûr de vouloir clôturer l'exercice ?"),
            okText: "Confirmer",
            cancelText: "Annuler",
            onOk: async () => {
                try {
                    setLoading(true);
                    const response = await accountingClosuresApi.startClosure({
                        open_exercise: openExercise
                    });

                    if (response.success) {
                        processIdRef.current = response.process_id;
                        setProcessStatus({
                            status: 'waiting',
                            progress: 0,
                            message: 'Démarrage...',
                            actions: {}
                        });
                        startPolling(response.process_id);
                        // Message différencié selon le contexte
                        message.info(
                            isClosed
                                ? "Processus d'ouverture d'exercice démarré"
                                : "Processus de clôture démarré"
                        );
                    }
                } catch (error) {
                    message.error("Erreur lors du démarrage: " + error.message);
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const startPolling = (pid) => {
        // S'assurer qu'il n'y a pas déjà un polling en cours
        stopPolling();

        const pollStatus = async () => {
            try {
                const response = await accountingClosuresApi.pollStatus(pid);

                if (!response) {
                    message.error("Impossible de récupérer le statut du processus");
                    stopPolling();
                    return;
                }

                setProcessStatus(response);

                // Si le processus est terminé ou en erreur, arrêter le polling
                if (response.status === 'completed') {
                    stopPolling();
                    // Message de succès différencié
                    const isOpeningExercise = processStatus?.isOpeningExercise;
                    message.success(
                        isOpeningExercise
                            ? "Nouvel exercice ouvert avec succès"
                            : "Clôture terminée avec succès"
                    );

                    // Attendre un peu avant de fermer pour que l'utilisateur voie le message
                    setTimeout(() => {
                        if (onSubmit) {
                            onSubmit();
                        }
                    }, 2000);
                } else if (response.status === 'error') {
                    stopPolling();
                    message.error(`Erreur: ${response.message}`);
                }
            } catch (error) {
                console.error("Erreur lors de la vérification du statut:", error);
                // Ne pas arrêter le polling sur une erreur temporaire
                // mais compter les erreurs consécutives
                if (!pollStatus.errorCount) {
                    pollStatus.errorCount = 0;
                }
                pollStatus.errorCount++;

                if (pollStatus.errorCount > 5) {
                    stopPolling();
                    message.error("Impossible de suivre l'avancement du processus");
                }
            }
        };

        // Première vérification immédiate
        pollStatus();

        // Puis polling toutes les secondes
        pollIntervalRef.current = setInterval(pollStatus, 1000);
    };

    const handleDownload = async () => {
        setDownloading(true);

        try {
            const response = await accountingClosuresApi.downloadArchive(closureId);

            // Création lien téléchargement
            const url = window.URL.createObjectURL(response);
            const link = document.createElement("a");
            link.href = url;

            // Utiliser le nom du fichier depuis closure si disponible
            const filename = closure?.documents?.[0]?.filename || `cloture_exercice_${closureId}.zip`;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            message.success("Téléchargement démarré");
        } catch (error) {
            message.error("Erreur lors du téléchargement");
        } finally {
            setDownloading(false);
        }
    };


    const renderActionIcon = (status) => {
        switch (status) {
            case 'processing':
                return <LoadingOutlined style={{ fontSize: 24, color: '#1890ff' }} spin />;
            case 'completed':
                return <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />;
            case 'error':
                return <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />;
            default:
                return <ClockCircleOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />;
        }
    };

    const renderClosureForm = () => {
        if (processStatus) {
            return (
                <Card>
                    <Flex vertical gap="large" style={{ width: '100%' }}>
                        <div>
                            <h3>Progression de la clôture</h3>
                            <p style={{ color: '#666' }}>{processStatus.message}</p>
                        </div>

                        <Progress
                            percent={Math.round(processStatus.progress)}
                            status={
                                processStatus.status === 'error' ? 'exception' :
                                    processStatus.status === 'completed' ? 'success' :
                                        'active'
                            }
                        />

                        {processStatus.actions && Object.keys(processStatus.actions).length > 0 && (
                            <Flex vertical gap="small" style={{ width: '100%' }}>
                                {Object.entries(processStatus.actions).map(([actionId, actionData]) => (
                                    <Card
                                        key={actionId}
                                        size="small"
                                        style={{
                                            borderColor: actionData.status === 'processing' ? '#1890ff' : undefined
                                        }}
                                    >
                                        <Space align="start" style={{ width: '100%' }}>
                                            {renderActionIcon(actionData.status)}
                                            <div style={{ flex: 1 }}>
                                                <div><strong>{actionData.label}</strong></div>
                                                {actionData.message && (
                                                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                                        {actionData.message}
                                                    </div>
                                                )}
                                            </div>
                                        </Space>
                                    </Card>
                                ))}
                            </Flex>
                        )}

                        {processStatus.status === 'completed' && (
                            <>
                                <Alert
                                    type="success"
                                    showIcon
                                    description="🎉 Clôture terminée avec succès ! L'exercice a été clôturé."
                                />
                                <Button type="primary" onClick={onClose} block>
                                    Fermer
                                </Button>
                            </>
                        )}

                        {processStatus.status === 'error' && (
                            <>
                                <Alert
                                    type="error"
                                    showIcon
                                    message="Erreur lors de la clôture"
                                    description={processStatus.message}
                                />
                                <Button onClick={onClose} block>
                                    Fermer
                                </Button>
                            </>
                        )}
                    </Flex>
                </Card>
            );
        }

        if (!currentExercise) {
            return <Alert description="Aucun exercice en cours" type="warning" />;
        }

        const isClosed = currentExercise.is_closed;

        if (isClosed) {
            return (
                <Card>
                    <Flex vertical gap="large" style={{ width: '100%' }}>
                        <Alert
                            type="info"
                            description="Pas d'exercice ouvert. Cliquez sur le bouton ci-dessous pour ouvrir un nouvel exercice."
                        />
                        {workerStatus.available === false && (
                            <Alert
                                type="error"
                                showIcon
                                message="Worker non disponible"
                                description={workerStatus.message}
                            />
                        )}
                        <Button
                            type="primary"
                            size="large"
                            onClick={handleStartClosure}
                            loading={loading || workerStatus.checking}
                            disabled={workerStatus.available === false}
                            block
                        >
                            {workerStatus.checking ? "Vérification du worker..." : "Ouvrir un nouvel exercice comptable"}
                        </Button>
                    </Flex>
                </Card>
            );
        }

        return (
            <Card>
                <Flex vertical gap="large" style={{ width: '100%' }}>
                    <div>
                        <h3>En quoi consiste la clôture comptable ?</h3>
                        <p>
                            La clôture comptable est une procédure essentielle qui marque la fin d'un exercice comptable.
                            Elle consiste à finaliser tous les enregistrements comptables, vérifier la cohérence des données,
                            effectuer les contrôles nécessaires et générer les documents officiels.
                        </p>
                        <p>
                            Cette opération garantit l'intégrité et la fiabilité de vos données comptables avant la production
                            des états financiers définitifs.
                        </p>
                    </div>

                    <Alert
                        type="warning"
                        showIcon
                        description="Attention : La clôture valide toutes les écritures de l'exercice, les modifications ne seront plus autorisées."
                    />

                    <div>
                        <h4>Exercice en cours</h4>
                        <p>
                            Du <strong>{currentExercise.start_date}</strong> au <strong>{currentExercise.end_date}</strong>
                        </p>
                    </div>

                    <Checkbox
                        checked={openExercise}
                        onChange={(e) => setOpenExercise(e.target.checked)}
                    >
                        Ouvrir automatiquement le nouvel exercice
                    </Checkbox>

                    {workerStatus.available === false && (
                        <Alert
                            type="error"
                            showIcon
                            message="Worker non disponible"
                            description={workerStatus.message}
                        />
                    )}

                    <Button
                        type="primary"
                        size="large"
                        onClick={handleStartClosure}
                        loading={loading || workerStatus.checking}
                        disabled={workerStatus.available === false}
                        block
                    >
                        {workerStatus.checking ? "Vérification du worker..." : "Lancer le traitement de fin d'année"}
                    </Button>
                </Flex>
            </Card>
        );
    };

    const renderClosureDetails = () => {
        if (!closure) return null;

        return (
            <Flex vertical gap="large" style={{ width: "100%" }}>
                <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="Période de l'exercice" span={2}>
                        {formatDate(closure.start_date)} - {formatDate(closure.end_date)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Date de clôture" span={2}>
                        {formatDate(closure.closing_date, 'DD/MM/YYYY HH:mm')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Clôturé par" span={2}>
                        {closure.closer?.name || 'N/A'}
                    </Descriptions.Item>
                </Descriptions>

                <Alert
                    type="info"
                    showIcon
                    description={
                        <>
                            <strong>Archive de clôture</strong>
                            <br />
                            L'archive ZIP contient l'ensemble des documents de clôture : FEC, Grand Livre, Balance, Bilan, Journaux et Centralisateur.
                        </>
                    }
                />

                {closure.documents && closure.documents.length > 0 ? (
                    <>
                        <Descriptions bordered column={1} size="small">
                            {closure.documents.map(doc => (
                                <Descriptions.Item key={doc.id} label="Fichier">
                                    <Flex justify="space-between" align="center">
                                        <div>
                                            <div><strong>{doc.filename}</strong></div>
                                            <div style={{ fontSize: 12, color: '#888' }}>
                                                {(doc.size / 1024 / 1024).toFixed(2)} MB
                                            </div>
                                        </div>
                                    </Flex>
                                </Descriptions.Item>
                            ))}
                        </Descriptions>

                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            size="large"
                            block
                            onClick={handleDownload}
                            loading={downloading}
                        >
                            Télécharger l'archive de clôture
                        </Button>                       
                    </>
                ) : (
                    <Alert
                        type="warning"
                        showIcon
                        description={
                            <>
                                <strong>Aucun document disponible</strong>
                                <br />
                                L'archive de clôture n'a pas été générée ou n'est plus disponible.
                            </>
                        }
                    />
                )}
            </Flex>
        );
    };

    return (
        <Drawer
            title={closureId ? "Détails de la clôture" : "Clôture d'exercice"}
            placement="right"
            open={open}
            onClose={onClose}
            size={drawerSize}
            closable={!processStatus || processStatus.status === 'completed' || processStatus.status === 'error'}
            maskClosable={false}
        >
            {loading && !processStatus ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <LoadingOutlined style={{ fontSize: 48 }} spin />
                    <p style={{ marginTop: 16 }}>Chargement...</p>
                </div>
            ) : (
                closureId ? renderClosureDetails() : renderClosureForm()
            )}
        </Drawer>
    );
}