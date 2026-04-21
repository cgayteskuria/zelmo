import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Button, Upload, Popconfirm, Space, Tag } from 'antd';
import { message } from '../../utils/antdStatic';
import { UploadOutlined, DownloadOutlined, DeleteOutlined, FileTextOutlined, FilePdfOutlined, FileImageOutlined, FileExcelOutlined, FileWordOutlined, FileOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { documentsApi } from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import './FilesTab.css';

/**
 * Composant réutilisable pour gérer les documents liés à un enregistrement
 * @param {Object} props
 * @param {string} props.module - Le module courant (ex: 'sale-orders', 'purchase-orders', 'invoices', 'contracts')
 * @param {number} props.recordId - L'ID de l'enregistrement
 * @param {Function} props.getDocumentsApi - Fonction API pour récupérer les documents
 * @param {Function} props.uploadDocumentsApi - Fonction API pour uploader les documents
 */
const FilesTab = ({ module, recordId, getDocumentsApi, uploadDocumentsApi, onCountChange }) => {
    const [loading, setLoading] = useState(false);
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // Permissions par module : {module}.document.{action}
    // Ex: sale-orders.document.upload, purchase-orders.document.delete

    const canUpload = usePermission(`${module}.document.upload`);
    const canDownload = usePermission(`${module}.document.download`);
    const canDelete = usePermission(`${module}.document.delete`);
    // Icônes par type de document
    const getFileIcon = (fileType) => {
        if (fileType.includes('pdf')) return <FilePdfOutlined style={{ color: '#d32f2f', fontSize: '18px' }} />;
        if (fileType.includes('image')) return <FileImageOutlined style={{ color: '#1976d2', fontSize: '18px' }} />;
        if (fileType.includes('word') || fileType.includes('document')) return <FileWordOutlined style={{ color: '#2196f3', fontSize: '18px' }} />;
        if (fileType.includes('excel') || fileType.includes('spreadsheet')) return <FileExcelOutlined style={{ color: '#4caf50', fontSize: '18px' }} />;
        if (fileType.includes('text')) return <FileTextOutlined style={{ color: '#757575', fontSize: '18px' }} />;
        return <FileOutlined style={{ color: '#9e9e9e', fontSize: '18px' }} />;
    };

    // Formatter la taille du document
    const formatFileSize = (sizeInBytes) => {
        const sizeInKB = sizeInBytes / 1000;
        if (sizeInKB < 1000) return Math.round(sizeInKB) + ' Ko';
        const sizeInMB = sizeInKB / 1000;
        return sizeInMB.toFixed(2) + ' Mo';
    };

    // Charger les documents
    const fetchDocuments = async () => {
        if (!recordId) return;

        setLoading(true);
        try {
            const response = await getDocumentsApi(recordId);
            const docs = response.data || [];
            setDocuments(docs);

            // 🔥 informer le parent
            onCountChange?.(docs.length);
        } catch (error) {
            console.error('Erreur lors du chargement des documents:', error);
            message.error('Erreur lors du chargement des documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [recordId]);

    // Gérer l'upload de documents
    const handleUpload = async (files) => {
        if (!files || files.length === 0) return;

        const formData = new FormData();
        Array.from(files).forEach((file) => {
            formData.append('files[]', file);
        });

        setUploading(true);
        try {
            await uploadDocumentsApi(recordId, formData);
            message.success('Document(s) téléversé(s) avec succès');
            fetchDocuments();
        } catch (error) {
            console.error('Erreur lors du téléversement:', error);
            message.error('Erreur lors du téléversement des documents');
        } finally {
            setUploading(false);
        }
    };

    // Télécharger un document
    const handleDownload = async (documentId, fileName) => {
        try {
            const response = await documentsApi.download(documentId);
            const url = window.URL.createObjectURL(response);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erreur lors du téléchargement:', error);
            message.error('Erreur lors du téléchargement du document');
        }
    };

    // Supprimer un Document
    const handleDelete = async (documentId) => {
        try {
            await documentsApi.delete(documentId);
            message.success('Document supprimé avec succès');
            fetchDocuments();
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            message.error('Erreur lors de la suppression du Document');
        }
    };

    // Gestion du drag & drop
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        if (!canUpload) return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleUpload(files);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (canUpload) {
            setDragOver(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    // Colonnes du tableau
    const columns = [
        { title: 'Type', dataIndex: 'fileType', key: 'fileType', width: 60, align: 'center', render: (fileType) => getFileIcon(fileType), },
        {
            title: 'Nom du document', dataIndex: 'fileName', key: 'fileName', ellipsis: true, render: (fileName, record) => (
                <a
                    onClick={() => canDownload && handleDownload(record.id, record.fileName)}
                    style={{ cursor: canDownload ? 'pointer' : 'not-allowed', color: canDownload ? 'inherit' : '#d9d9d9' }}
                >
                    {fileName}
                </a>
            ),
        },
        {
            title: 'Taille', dataIndex: 'fileSize', key: 'fileSize', width: 100, render: (fileSize) => formatFileSize(fileSize),
        },
        {
            title: 'Date', dataIndex: 'createdAt', key: 'createdAt', width: 120, render: (date) => dayjs(date).format('DD/MM/YYYY'),
        },
        {
            title: ' ', key: 'actions', width: 120, align: 'center',
            render: (_, record) => (
                <Space size="small">
                    {canDownload && (
                        <Button
                            type="text"
                            icon={<DownloadOutlined />}
                            size="small"
                            onClick={() => handleDownload(record.id, record.fileName)}
                            title="Télécharger"
                            disabled={!canDownload}
                        />
                    )}
                    {canDelete && (
                        <Popconfirm
                            title="Êtes-vous sûr de vouloir supprimer ce Document ?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Oui"
                            cancelText="Non"
                            okButtonProps={{ danger: true, disabled: false }}
                            cancelButtonProps={{ disabled: false }}
                        >
                            <Button
                                disabled={!canDelete}
                                type="text"
                                icon={<DeleteOutlined />}
                                size="small"
                                danger
                                title="Supprimer"
                            />
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    if (!recordId) {
        return (
            <Card>
                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                    Veuillez enregistrer d'abord l'enregistrement pour ajouter des documents
                </p>
            </Card>
        );
    }

    return (
        <div
            className={`files-tab-container ${dragOver ? 'drag-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <div >
                <div style={{ width: "100%", padding: "10px 0px 20px 0px", textAlign: "left" }}>
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        loading={uploading}
                        disabled={!canUpload || uploading}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Téléverser un document
                    </Button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleUpload(e.target.files)}
                />

                {dragOver && (
                    <div className="drag-overlay">
                        <div className="drag-message">
                            <UploadOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                            <p>Déposez vos documents ici</p>
                        </div>
                    </div>
                )}

                <Table
                    columns={columns}
                    dataSource={documents}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="small"
                    bordered
                    locale={{
                        emptyText: 'Aucun document attaché. Glissez-déposez vos documents ici ou cliquez sur le bouton ci-dessus.',
                    }}
                />
            </div>
        </div>
    );
};

export default FilesTab;
