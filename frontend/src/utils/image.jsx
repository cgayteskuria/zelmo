// Fonction utilitaire pour compresser les images
export async function compressImage({ file, maxSizeMB = 1, maxWidthOrHeight = 1920, quality = 0.8 }) {

    // 👉 Ne pas toucher aux PDF ou fichiers non images
    if (!file.type.startsWith("image/")) {
        return file;
    }

    // 👉 Si déjà assez petit, on ne fait rien
    if (file.size <= maxSizeMB * 1024 * 1024) {
        return file;
    }


    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);
    let { width, height } = img;


    // 👉 Resize proportionnel
    if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
            height = Math.round((height * maxWidthOrHeight) / width);
            width = maxWidthOrHeight;
        } else {
            width = Math.round((width * maxWidthOrHeight) / height);
            height = maxWidthOrHeight;
        }       
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        console.error("❌ Impossible de créer le contexte canvas");
        return file;
    }


    ctx.drawImage(img, 0, 0, width, height);
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await canvasToBlob(canvas, outputType, quality);

    return new File([blob], file.name.replace(/\.(png|jpg|jpeg|webp)$/i, ".jpg"), {
        type: outputType,
        lastModified: Date.now()
    });
}

// Fonctions helper (à ajouter si elles n'existent pas)
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Échec de la conversion en blob"));
            },
            type,
            quality
        );
    });
}

/**
 * Fonction utilitaire pour faire pivoter une image
 * @param {File|Blob} file - Le fichier image à faire pivoter
 * @param {number} degrees - L'angle de rotation (90, 180, 270)
 * @returns {Promise<File>} - Le nouveau fichier image pivoté
 */
export async function rotateImage(file, degrees) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                // Créer un canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculer les nouvelles dimensions en fonction de la rotation
                if (degrees === 90 || degrees === 270) {
                    canvas.width = img.height;
                    canvas.height = img.width;
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }
                
                // Appliquer la rotation
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((degrees * Math.PI) / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
                
                // Convertir le canvas en blob puis en File
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Erreur lors de la rotation'));
                        return;
                    }
                    
                    const rotatedFile = new File(
                        [blob], 
                        file.name, 
                        { 
                            type: file.type,
                            lastModified: Date.now()
                        }
                    );
                    
                    resolve(rotatedFile);
                }, file.type, 0.95);
            };
            
            img.onerror = () => reject(new Error('Erreur lors du chargement de l\'image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
        reader.readAsDataURL(file);
    });
}