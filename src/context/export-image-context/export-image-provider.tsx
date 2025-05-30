import React, { useCallback, useMemo } from 'react';
import type { ExportImageContext, ImageType } from './export-image-context';
import { exportImageContext } from './export-image-context';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import { useReactFlow } from '@xyflow/react';
import { useFullScreenLoader } from '@/hooks/use-full-screen-spinner';
import { useTheme } from '@/hooks/use-theme';

export const ExportImageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { hideLoader, showLoader } = useFullScreenLoader();
    const { setNodes, getViewport } = useReactFlow();
    const { effectiveTheme } = useTheme();

    const imageCreatorMap: Record<
        ImageType,
        typeof toJpeg | typeof toPng | typeof toSvg
    > = useMemo(
        () => ({
            jpeg: toJpeg,
            png: toPng,
            svg: toSvg,
        }),
        []
    );

    const exportImage: ExportImageContext['exportImage'] = useCallback(
        async (type, { includePatternBG, transparent, scale }) => {
            try {
                console.log(
                    `[export-provider] Экспорт изображения типа: ${type}`
                );

                showLoader({
                    animated: false,
                });

                // Reset node selection before export
                setNodes((nodes) =>
                    nodes.map((node) => ({ ...node, selected: false }))
                );

                const viewport = getViewport();
                const reactFlowBounds = document
                    .querySelector('.react-flow')
                    ?.getBoundingClientRect();

                if (!reactFlowBounds) {
                    throw new Error('Could not find react-flow bounds');
                }

                const viewportElement = document.querySelector(
                    '.react-flow__viewport'
                ) as HTMLElement;
                if (!viewportElement) {
                    throw new Error('Could not find viewport element');
                }

                // Create a temporary SVG for markers
                const markerDefs = document.querySelector(
                    '.react-flow__viewport > svg > defs'
                );

                const tempSvg = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'svg'
                );
                tempSvg.style.position = 'absolute';
                tempSvg.style.top = '0';
                tempSvg.style.left = '0';
                tempSvg.style.width = '100%';
                tempSvg.style.height = '100%';
                tempSvg.style.overflow = 'visible';
                tempSvg.style.zIndex = '-50';
                tempSvg.setAttribute(
                    'viewBox',
                    `0 0 ${reactFlowBounds.width} ${reactFlowBounds.height}`
                );

                const defs = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'defs'
                );

                if (markerDefs) {
                    defs.innerHTML = markerDefs.innerHTML;
                }

                if (includePatternBG) {
                    const pattern = document.createElementNS(
                        'http://www.w3.org/2000/svg',
                        'pattern'
                    );
                    pattern.setAttribute('id', 'background-pattern');
                    pattern.setAttribute('width', String(16 * viewport.zoom));
                    pattern.setAttribute('height', String(16 * viewport.zoom));
                    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
                    pattern.setAttribute(
                        'patternTransform',
                        `translate(${viewport.x % (16 * viewport.zoom)} ${viewport.y % (16 * viewport.zoom)})`
                    );

                    const dot = document.createElementNS(
                        'http://www.w3.org/2000/svg',
                        'circle'
                    );

                    const dotSize = viewport.zoom * 0.5;
                    dot.setAttribute('cx', String(viewport.zoom));
                    dot.setAttribute('cy', String(viewport.zoom));
                    dot.setAttribute('r', String(dotSize));
                    const dotColor =
                        effectiveTheme === 'light' ? '#92939C' : '#777777';
                    dot.setAttribute('fill', dotColor);

                    pattern.appendChild(dot);
                    defs.appendChild(pattern);
                }

                tempSvg.appendChild(defs);

                const backgroundRect = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'rect'
                );
                const bgPadding = 2000;
                backgroundRect.setAttribute(
                    'x',
                    String(-viewport.x - bgPadding)
                );
                backgroundRect.setAttribute(
                    'y',
                    String(-viewport.y - bgPadding)
                );
                backgroundRect.setAttribute(
                    'width',
                    String(reactFlowBounds.width + 2 * bgPadding)
                );
                backgroundRect.setAttribute(
                    'height',
                    String(reactFlowBounds.height + 2 * bgPadding)
                );
                backgroundRect.setAttribute('fill', 'url(#background-pattern)');
                tempSvg.appendChild(backgroundRect);

                viewportElement.insertBefore(
                    tempSvg,
                    viewportElement.firstChild
                );

                const imageCreateFn = imageCreatorMap[type];
                console.log(
                    `[export-provider] Вызываем функцию создания изображения для типа: ${type}`
                );

                let dataUrl;

                if (type === 'svg') {
                    try {
                        console.log('[export-provider] Начинаем создание SVG');

                        // Для SVG используем специальные параметры
                        dataUrl = await toSvg(viewportElement, {
                            backgroundColor: transparent
                                ? 'transparent'
                                : effectiveTheme === 'light'
                                  ? '#ffffff'
                                  : '#1a1a1a',
                            width: reactFlowBounds.width,
                            height: reactFlowBounds.height,
                            style: {
                                width: `${reactFlowBounds.width}px`,
                                height: `${reactFlowBounds.height}px`,
                                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                            },
                            filter: (node) => {
                                // Исключаем некоторые элементы, которые могут вызывать проблемы
                                const excludeClasses = [
                                    'react-flow__minimap',
                                    'react-flow__controls',
                                ];
                                return !excludeClasses.some((className) =>
                                    node.classList?.contains(className)
                                );
                            },
                            skipFonts: true,
                        });

                        console.log(
                            '[export-provider] SVG создан успешно, длина data URL:',
                            dataUrl?.length || 0
                        );

                        // Сразу запускаем скачивание SVG
                        console.log(
                            '[export-provider] Пытаемся скачать SVG напрямую из провайдера'
                        );

                        try {
                            // Используем fetch для получения данных SVG
                            console.log(
                                '[export-provider] Используем fetch для получения SVG'
                            );
                            const response = await fetch(dataUrl);
                            const blob = await response.blob();
                            console.log(
                                '[export-provider] Получен blob, размер:',
                                blob.size
                            );

                            // Создаем URL для скачивания
                            const url = URL.createObjectURL(blob);

                            // Приоритет - скачивание SVG
                            console.log(
                                '[export-provider] Приоритетно используем прямое скачивание SVG'
                            );

                            // Создаем ссылку для скачивания
                            const link = document.createElement('a');
                            link.download = 'diagram.svg';
                            link.href = url;
                            link.style.display = 'none';
                            document.body.appendChild(link);

                            console.log(
                                '[export-provider] Запускаем скачивание SVG'
                            );
                            link.click();

                            // Даем время на скачивание
                            await new Promise((resolve) =>
                                setTimeout(resolve, 1000)
                            ); // Увеличиваем время ожидания

                            document.body.removeChild(link);

                            // Очищаем URL после задержки
                            setTimeout(() => URL.revokeObjectURL(url), 5000);

                            console.log(
                                '[export-provider] SVG обработка завершена'
                            );
                        } catch (downloadError) {
                            console.error(
                                '[export-provider] Ошибка при скачивании SVG:',
                                downloadError
                            );

                            // Дополнительная попытка - открыть SVG в новом окне
                            try {
                                const newWindow = window.open(
                                    dataUrl,
                                    '_blank'
                                );
                                console.log(
                                    '[export-provider] Попытка открыть SVG в новом окне:',
                                    newWindow ? 'успешно' : 'неудача'
                                );
                            } catch (windowError) {
                                console.error(
                                    '[export-provider] Не удалось открыть SVG в новом окне:',
                                    windowError
                                );
                            }
                        }
                    } catch (error) {
                        const svgError = error as Error;
                        console.error(
                            '[export-provider] Ошибка при создании SVG:',
                            svgError
                        );
                        throw new Error(
                            `Ошибка при создании SVG: ${svgError.message || 'Неизвестная ошибка'}`
                        );
                    }
                } else {
                    // Для других типов используем стандартный подход
                    dataUrl = await imageCreateFn(viewportElement, {
                        backgroundColor: transparent
                            ? 'transparent'
                            : effectiveTheme === 'light'
                              ? '#ffffff'
                              : '#1a1a1a',
                        width: reactFlowBounds.width,
                        height: reactFlowBounds.height,
                        style: {
                            width: `${reactFlowBounds.width}px`,
                            height: `${reactFlowBounds.height}px`,
                            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                        },
                        quality: 1,
                        pixelRatio: scale,
                        skipFonts: true,
                    });
                }

                // Remove temporary SVG after getting the image
                if (
                    viewportElement &&
                    tempSvg &&
                    viewportElement.contains(tempSvg)
                ) {
                    viewportElement.removeChild(tempSvg);
                }

                return dataUrl;
            } catch (error) {
                console.error('Error exporting image:', error);
                throw error;
            } finally {
                hideLoader();
                setNodes((nodes) => [...nodes]);
            }
        },
        [
            getViewport,
            hideLoader,
            imageCreatorMap,
            setNodes,
            showLoader,
            effectiveTheme,
        ]
    );

    return (
        <exportImageContext.Provider value={{ exportImage }}>
            {children}
        </exportImageContext.Provider>
    );
};
