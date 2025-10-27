/**
 * Utility functions for image processing
 */

/**
 * Auto-crops image by removing transparent/white space from edges
 * @param dataUrl - image data URL to crop
 * @param padding - optional padding to add around the cropped area (in pixels)
 * @param format - image format ('png' or 'jpeg')
 * @returns Promise with cropped image data URL
 */
export const autoCropImage = async (
    dataUrl: string,
    padding: number = 30,
    format: string = 'png'
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                // Create canvas with the original image dimensions
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                canvas.width = img.width;
                canvas.height = img.height;

                // Draw the image on the canvas
                ctx.drawImage(img, 0, 0);

                // Get image data to analyze pixels
                const imageData = ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );
                const data = imageData.data;

                // Find the bounds of non-transparent/non-white pixels
                let minX = canvas.width;
                let minY = canvas.height;
                let maxX = 0;
                let maxY = 0;

                // Сканируем с шагом для ускорения
                const step = 3; // используем шаг 3 для баланса между скоростью и точностью

                // Сканирование пикселей
                for (let y = 0; y < canvas.height; y += step) {
                    for (let x = 0; x < canvas.width; x += step) {
                        const idx = (y * canvas.width + x) * 4;

                        // Анализируем цвет пикселя для определения содержимого
                        const r = data[idx];
                        const g = data[idx + 1];
                        const b = data[idx + 2];
                        const a = data[idx + 3];

                        // Улучшенный алгоритм определения контента:
                        // 1. Считаем содержимым пиксели с большой непрозрачностью и не белые
                        // 2. Также проверяем, если есть значительная разница между RGB каналами

                        // Проверка на непрозрачный и не белый пиксель
                        const isNotTransparent = a > 30;
                        const isNotWhite = !(r > 235 && g > 235 && b > 235);

                        // Проверка на достаточную разницу между RGB каналами
                        const maxDiff = Math.max(
                            Math.abs(r - g),
                            Math.abs(r - b),
                            Math.abs(g - b)
                        );
                        const hasColorVariation = maxDiff > 15;

                        // Проверка на достаточно темный цвет (не близкий к белому)
                        const brightness = (r + g + b) / 3;
                        const isDark = brightness < 230;

                        // Объединяем условия
                        const isContentPixel =
                            isNotTransparent &&
                            (isNotWhite || hasColorVariation || isDark);

                        if (isContentPixel) {
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }

                // Add padding
                minX = Math.max(0, minX - padding);
                minY = Math.max(0, minY - padding);
                maxX = Math.min(canvas.width, maxX + padding);
                maxY = Math.min(canvas.height, maxY + padding);

                // Проверяем, нашли ли мы какой-либо контент
                if (minX >= maxX || minY >= maxY) {
                    // Контент не найден, возвращаем оригинальное изображение
                    resolve(dataUrl);
                    return;
                }

                // Calculate new dimensions
                const width = maxX - minX;
                const height = maxY - minY;

                // Создаем новый canvas для обрезанного изображения
                console.log('DEBUG: Creating cropped canvas', width, height);
                const croppedCanvas = document.createElement('canvas');
                const croppedCtx = croppedCanvas.getContext('2d');
                if (!croppedCtx) {
                    reject(new Error('Could not get cropped canvas context'));
                    return;
                }

                // Set dimensions for the cropped canvas
                croppedCanvas.width = width;
                croppedCanvas.height = height;

                // Draw the cropped region into the new canvas
                croppedCtx.drawImage(
                    canvas,
                    minX,
                    minY,
                    width,
                    height, // Source rectangle
                    0,
                    0,
                    width,
                    height // Destination rectangle
                );

                // Конвертируем canvas в data URL
                const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

                const croppedDataUrl = croppedCanvas.toDataURL(mimeType);

                resolve(croppedDataUrl);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = (error) => {
            reject(error);
        };

        img.src = dataUrl;
    });
};
