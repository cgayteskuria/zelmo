import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { useIsMobile } from '../../../utils/deviceDetection';

// Lazy loading des composants
const ExpenseReportDesktop = lazy(() => import('./ExpenseReport'));
const ExpenseReportMobile = lazy(() => import('./ExpenseReportMobile'));

// Composant de chargement
const PageLoader = () => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f5f5'
    }}>
        <Spin size="large" />
        <div style={{ marginTop: 8, color: 'rgba(0,0,0,0.45)' }}>Chargement...</div>
    </div>
);

/**
 * Wrapper intelligent qui charge la version mobile ou desktop
 * selon le type d'appareil
 */
export default function ExpenseReportWrapper(props) {
    const isMobile = useIsMobile();

    return (
        <Suspense fallback={<PageLoader />}>
            {isMobile ? (
                <ExpenseReportMobile {...props} />
            ) : (
                <ExpenseReportDesktop {...props} />
            )}
        </Suspense>
    );
}
