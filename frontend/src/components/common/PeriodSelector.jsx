import { useState, useEffect } from "react";
import { Select, DatePicker, Space, Typography } from "antd";
import { DownOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getWritingPeriod } from "../../utils/writingPeriod";
import { accountingClosuresApi } from "../../services/apiAccounts";

const { Text } = Typography;

/**
 * Sélecteur de période (date début / date fin) avec liste déroulante de raccourcis.
 *
 * Props :
 *   value      – { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 *   onChange   – appelé avec { start, end }
 *   presets    – true  → les presets sont calculés en interne (exercice courant, n-1, période d'écriture)
 *              – false (défaut) → aucun preset, pas de liste déroulante
 *   minDate / maxDate – dayjs | undefined
 *   disabled   – bool
 */
export default function PeriodSelector({
    value = {},
    onChange,
    presets = false,
    minDate,
    maxDate,
    disabled = false,
}) {
    const { start, end } = value || {};
    const [preset, setPreset] = useState(null);
    const [resolvedPresets, setResolvedPresets] = useState([]);

    // Charge les presets depuis l'API quand presets === true
    useEffect(() => {
        if (presets !== true) {
            setResolvedPresets([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const [wp, exRes] = await Promise.all([
                    getWritingPeriod(),
                    accountingClosuresApi.getCurrentExercise(),
                ]);
                if (cancelled) return;
                const ex = exRes.data;
                const list = [];
                if (ex?.start_date && ex?.end_date) {
                    const yr = dayjs(ex.start_date).format("YYYY");
                    list.push({
                        label: `Exercice courant (${yr})`,
                        value: "current",
                        start: ex.start_date,
                        end: ex.end_date,
                    });
                }
                if (wp?.startDate && ex?.start_date && wp.startDate < ex.start_date) {
                    list.push({
                        label: `Exercice n-1 (${dayjs(wp.startDate).format("YYYY")})`,
                        value: "prev",
                        start: wp.startDate,
                        end: dayjs(ex.start_date).subtract(1, "day").format("YYYY-MM-DD"),
                    });
                }
                if (wp?.startDate && wp?.endDate) {
                    list.push({
                        label: "Période d'écriture (les deux exercices)",
                        value: "writing",
                        start: wp.startDate,
                        end: wp.endDate,
                    });
                }
                setResolvedPresets(list);
            } catch {
                setResolvedPresets([]);
            }
        })();
        return () => { cancelled = true; };
    }, [presets]);

    // Synchronise le select avec la valeur courante
    useEffect(() => {
        if (!start) { setPreset(null); return; }
        const match = resolvedPresets.find((p) => p.start === start && p.end === end);
        setPreset(match ? match.value : "custom");
    }, [start, end, resolvedPresets]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePreset = (p) => {
        if (p === "custom") { setPreset("custom"); return; }
        setPreset(p);
        const found = resolvedPresets.find((x) => x.value === p);
        if (found) onChange?.({ start: found.start, end: found.end });
    };

    const handleStartChange = (d) => {
        setPreset("custom");
        onChange?.({ start: d?.format("YYYY-MM-DD") ?? null, end: end ?? null });
    };

    const handleEndChange = (d) => {
        setPreset("custom");
        onChange?.({ start: start ?? null, end: d?.format("YYYY-MM-DD") ?? null });
    };

    const selectOptions = [
        ...resolvedPresets.map((p) => ({ label: p.label, value: p.value })),
        { label: "Période personnalisée", value: "custom" },
    ];

    const showDropdown = presets === true && resolvedPresets.length > 0;

    return (
        <Space align="center">
            <span style={{ display: "inline-flex", alignItems: "stretch" }}>
                <DatePicker
                    value={start ? dayjs(start) : null}
                    onChange={handleStartChange}
                    format="DD/MM/YYYY"
                    placeholder="Date de début"
                    minDate={minDate}
                    maxDate={maxDate}
                    disabled={disabled}
                    style={{
                        borderRadius: showDropdown ? "6px 0 0 6px" : undefined,
                    }}
                />
                {showDropdown && (
                    <Select
                        value={preset ?? undefined}
                        onChange={handlePreset}
                        options={selectOptions}
                        disabled={disabled}
                        allowClear={false}
                        popupMatchSelectWidth={false}
                        placement="bottomLeft"
                        suffixIcon={
                            <DownOutlined
                                style={{
                                    fontSize: 11,
                                    color: disabled ? "#bfbfbf" : "#595959",
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    pointerEvents: "none",
                                }}
                            />
                        }
                        labelRender={() => null}
                        style={{
                            width: 28,
                            marginLeft: -1,
                        }}
                        styles={{
                            selector: {
                                borderRadius: "0 6px 6px 0",
                                padding: 0,
                                position: "relative",
                                overflow: "visible",
                            },
                        }}
                    />
                )}
            </span>

            <Text type="secondary">au</Text>

            <DatePicker
                value={end ? dayjs(end) : null}
                onChange={handleEndChange}
                format="DD/MM/YYYY"
                placeholder="Date de fin"
                minDate={minDate}
                maxDate={maxDate}
                disabled={disabled}
            />
        </Space>
    );
}
