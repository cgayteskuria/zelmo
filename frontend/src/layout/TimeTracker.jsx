import { useState, useEffect, useRef, useCallback } from "react";
import { Popover, Button, Form, Modal } from "antd";
import { message } from '../utils/antdStatic';
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import { timeEntriesApi } from "../services/api";
import PartnerSelect from "../components/select/PartnerSelect";
import TimeProjectSelect from "../components/select/TimeProjectSelect";

const STORAGE_KEY = "zelmo_timer";
const MAX_HOURS = 12;

function generateUuid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getTimer() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function setTimer(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearTimer() {
    localStorage.removeItem(STORAGE_KEY);
}

function formatElapsed(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimeTracker() {
    const [timerState, setTimerState] = useState(() => getTimer());
    const [elapsed, setElapsed] = useState(0);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const intervalRef = useRef(null);
    const [form] = Form.useForm();
    const [selectedPtrId, setSelectedPtrId] = useState(null);
    const projectSelectRef = useRef(null);

    const isRunning = !!timerState?.running;

    // Mise à jour du compteur
    const updateElapsed = useCallback(() => {
        const t = getTimer();
        if (t?.running && t?.startedAt) {
            setElapsed(Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 1000));
        }
    }, []);

    useEffect(() => {
        if (isRunning) {
            updateElapsed();
            intervalRef.current = setInterval(updateElapsed, 1000);
        } else {
            clearInterval(intervalRef.current);
            setElapsed(0);
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning, updateElapsed]);

    // Synchronisation multi-onglets
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === STORAGE_KEY) {
                setTimerState(getTimer());
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    // Alerte timer > 12h au montage
    useEffect(() => {
        const t = getTimer();
        if (t?.running && t?.startedAt) {
            const hours = (Date.now() - new Date(t.startedAt).getTime()) / 3600000;
            if (hours > MAX_HOURS) {
                Modal.confirm({
                    title: "Timer actif depuis plus de 12h",
                    content: "Souhaitez-vous l'arrêter ?",
                    okText: "Arrêter",
                    cancelText: "Continuer",
                    onOk: () => {
                        clearTimer();
                        setTimerState(null);
                    },
                });
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleStart = () => {
        const data = {
            uuid: generateUuid(),
            running: true,
            startedAt: new Date().toISOString(),
        };
        setTimer(data);
        setTimerState(data);
    };

    const handleStop = () => {
        setPopoverOpen(true);
    };

    const handleSave = async () => {
        const t = getTimer();
        if (!t?.startedAt) return;

        const values = await form.validateFields().catch(() => null);
        if (!values) return;

        const durationMins = Math.max(1, Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 60000));

        setSaving(true);
        try {
            await timeEntriesApi.create({
                ten_date: new Date().toISOString().slice(0, 10),
                ten_start_time: new Date(t.startedAt).toTimeString().slice(0, 5),
                ten_end_time: new Date().toTimeString().slice(0, 5),
                ten_duration: durationMins,
                fk_ptr_id: values.fk_ptr_id || null,
                fk_tpr_id: values.fk_tpr_id || null,
                ten_description: values.ten_description || "",
                ten_is_billable: true,
            });
            message.success("Saisie enregistrée !");
            clearTimer();
            setTimerState(null);
            setPopoverOpen(false);
            form.resetFields();
            setSelectedPtrId(null);
        } catch {
            message.error("Erreur lors de l'enregistrement.");
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        clearTimer();
        setTimerState(null);
        setPopoverOpen(false);
        form.resetFields();
        setSelectedPtrId(null);
    };

    const popoverContent = (
        <div style={{ width: 280 }}>
            <Form form={form} layout="vertical" size="small">
                <Form.Item name="fk_ptr_id" label="Client" style={{ marginBottom: 8 }}>
                    <PartnerSelect
                        loadInitially
                        size="small"
                        onChange={(v) => {
                            setSelectedPtrId(v);
                            form.setFieldValue("fk_tpr_id", null);
                            projectSelectRef.current?.reload();
                        }}
                    />
                </Form.Item>
                <Form.Item name="fk_tpr_id" label="Projet" style={{ marginBottom: 8 }}>
                    <TimeProjectSelect
                        ref={projectSelectRef}
                        filters={selectedPtrId ? { fk_ptr_id: selectedPtrId } : {}}
                        loadInitially={!!selectedPtrId}
                        size="small"
                    />
                </Form.Item>
                <Form.Item name="ten_description" label="Description" style={{ marginBottom: 12 }}>
                    <input
                        placeholder="Ce que vous avez fait…"
                        style={{
                            width: "100%", padding: "4px 8px", fontSize: 12,
                            border: "1px solid var(--color-border)", borderRadius: 6,
                            outline: "none",
                        }}
                        onChange={(e) => form.setFieldValue("ten_description", e.target.value)}
                    />
                </Form.Item>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button size="small" onClick={handleCancel}>Annuler</Button>
                    <Button size="small" type="primary" loading={saving} onClick={handleSave}>
                        Enregistrer
                    </Button>
                </div>
            </Form>
        </div>
    );

    if (!isRunning) {
        return (
            <button
                onClick={handleStart}
                style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "transparent", border: "1px solid var(--color-border)",
                    borderRadius: 20, padding: "4px 12px", cursor: "pointer",
                    fontSize: 13, color: "var(--color-text)", fontFamily: "var(--font)",
                    transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-active)"; e.currentTarget.style.color = "var(--color-active)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-text)"; }}
                title="Démarrer un timer"
            >
                <PlayCircleOutlined />
                <span>Démarrer</span>
            </button>
        );
    }

    return (
        <Popover
            content={popoverContent}
            title="Arrêter le timer"
            trigger="click"
            open={popoverOpen}
            onOpenChange={setPopoverOpen}
            placement="bottomRight"
        >
            <button
                onClick={handleStop}
                style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "#fef2f2", border: "1px solid #fca5a5",
                    borderRadius: 20, padding: "4px 12px", cursor: "pointer",
                    fontSize: 13, color: "#dc2626", fontFamily: "var(--font)",
                    fontWeight: 600,
                }}
                title="Arrêter le timer"
            >
                <PauseCircleOutlined />
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatElapsed(elapsed)}</span>
            </button>
        </Popover>
    );
}
