import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Hook de navigation précédent/suivant dans une liste.
 *
 * Utilisation :
 * - Les pages de liste passent { ids, currentIndex, basePath } via le state React Router lors du navigate()
 * - Ce hook lit ce state et expose les fonctions de navigation
 * - Si aucun state n'est présent (accès direct, refresh), hasNav vaut false
 */
export function useListNavigation() {
    const location = useLocation();
    const navigate = useNavigate();

    const state = location.state;
    const ids = state?.ids;
    const currentIndex = state?.currentIndex;
    const basePath = state?.basePath;

    if (!ids || currentIndex == null || !basePath) {
        return { hasNav: false };
    }

    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < ids.length - 1;

    const goToPrev = () => {
        if (hasPrev) {
            navigate(`${basePath}/${ids[currentIndex - 1]}`, {
                state: { ids, currentIndex: currentIndex - 1, basePath },
            });
        }
    };

    const goToNext = () => {
        if (hasNext) {
            navigate(`${basePath}/${ids[currentIndex + 1]}`, {
                state: { ids, currentIndex: currentIndex + 1, basePath },
            });
        }
    };

    return {
        hasNav: true,
        hasPrev,
        hasNext,
        position: `${currentIndex + 1} / ${ids.length}`,
        goToPrev,
        goToNext,
    };
}
