import { useState, useEffect } from 'react';

/**
 * Hook pour détecter si l'appareil est mobile
 * @returns {boolean} true si mobile, false sinon
 */
export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Fonction pour vérifier si on est sur mobile
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            
            // Vérifier par User Agent
            const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
            const isMobileUA = mobileRegex.test(userAgent);
            
            // Vérifier par taille d'écran (moins de 768px = mobile)
            const isMobileScreen = window.innerWidth < 768;
            
            // Vérifier le touch support
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            
            // Considérer comme mobile si: UA mobile OU (petit écran ET touch)
            setIsMobile(isMobileUA || (isMobileScreen && hasTouch));
        };

        // Vérifier au chargement
        checkMobile();

        // Réévaluer lors du redimensionnement
        const handleResize = () => {
            checkMobile();
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
};

/**
 * Détecte si on est sur un appareil tactile
 * @returns {boolean}
 */
export const isTouchDevice = () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * Obtient la taille de l'écran
 * @returns {object} { width, height, isMobile, isTablet, isDesktop }
 */
export const useScreenSize = () => {
    const [screenSize, setScreenSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024
    });

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            setScreenSize({
                width,
                height,
                isMobile: width < 768,
                isTablet: width >= 768 && width < 1024,
                isDesktop: width >= 1024
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return screenSize;
};

/**
 * Détecte le système d'exploitation
 * @returns {string} 'iOS', 'Android', 'Windows', 'MacOS', 'Linux', 'Unknown'
 */
export const detectOS = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    if (/android/i.test(userAgent)) {
        return 'Android';
    }

    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return 'iOS';
    }

    if (/Win/i.test(userAgent)) {
        return 'Windows';
    }

    if (/Mac/i.test(userAgent)) {
        return 'MacOS';
    }

    if (/Linux/i.test(userAgent)) {
        return 'Linux';
    }

    return 'Unknown';
};

/**
 * Vérifie si la caméra est disponible
 * @returns {Promise<boolean>}
 */
export const isCameraAvailable = async () => {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return false;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.kind === 'videoinput');
    } catch (error) {
        console.error('Error checking camera availability:', error);
        return false;
    }
};

/**
 * Demande l'accès à la caméra
 * @returns {Promise<MediaStream|null>}
 */
export const requestCameraAccess = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } // Caméra arrière par défaut
        });
        return stream;
    } catch (error) {
        console.error('Error accessing camera:', error);
        return null;
    }
};

/**
 * Hook pour détecter l'orientation de l'appareil
 * @returns {string} 'portrait' ou 'landscape'
 */
export const useOrientation = () => {
    const [orientation, setOrientation] = useState(
        window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
    );

    useEffect(() => {
        const handleOrientationChange = () => {
            setOrientation(
                window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
            );
        };

        window.addEventListener('resize', handleOrientationChange);
        window.addEventListener('orientationchange', handleOrientationChange);

        return () => {
            window.removeEventListener('resize', handleOrientationChange);
            window.removeEventListener('orientationchange', handleOrientationChange);
        };
    }, []);

    return orientation;
};

/**
 * Vérifie si on est en mode standalone (PWA installée)
 * @returns {boolean}
 */
export const isStandalone = () => {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
    );
};

/**
 * Obtient les capacités de l'appareil
 * @returns {object}
 */
export const getDeviceCapabilities = () => {
    return {
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        hasTouch: isTouchDevice(),
        os: detectOS(),
        isStandalone: isStandalone(),
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
    };
};
