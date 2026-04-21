import React from 'react';
import { Breadcrumb } from 'antd';

/**
 * Composant PageContainer réutilisable
 * Fournit un design cohérent pour toutes les pages de l'application
 * avec dégradés, ombres et espacement optimisé
 */
export default function PageContainer({
    title,
    children,
    actions,
    breadcrumb,
    showHeader = true,
    headerStyle = {},
    contentStyle = {},
    fill = false,
}) {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            ...(fill ? { flex: 1, minHeight: 0 } : {}),
            ...contentStyle
        }}>
            {/* Breadcrumb */}
            {breadcrumb && (
                <div style={{ padding: '4px var(--space-xl) 0', marginBottom: 4 }}>
                    <Breadcrumb items={breadcrumb} />
                </div>
            )}

            {/* Topbar : titre + actions — style charter */}
            {showHeader && (
                <div style={{
                    padding: 'var(--space-md) var(--space-xl)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border)',
                    flexShrink: 0,
                    ...headerStyle
                }}>
                    {title && (
                        <h1 style={{
                            margin: 0,
                            fontSize: 'var(--text-xl)',
                            fontWeight: 'var(--font-medium)',
                            color: 'var(--color-text)',
                            fontFamily: 'var(--font)',
                        }}>
                            {title}
                        </h1>
                    )}

                    {headerStyle?.center && (
                        <div style={{ textAlign: 'center' }}>
                            {headerStyle.center}
                        </div>
                    )}

                    {actions && (
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                            {actions}
                        </div>
                    )}
                </div>
            )}

            <div style={fill
                ? { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
                : { padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }
            }>
                {children}
            </div>
        </div>
    );
}
