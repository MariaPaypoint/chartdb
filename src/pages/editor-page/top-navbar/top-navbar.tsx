import React, { useCallback, useState, useEffect, useRef } from 'react';
import ChartDBLogo from '@/assets/logo-light.png';
import ChartDBDarkLogo from '@/assets/logo-dark.png';
import { useTheme } from '@/hooks/use-theme';
import { DiagramName } from './diagram-name';
import { LastSaved } from './last-saved';
import { LanguageNav } from './language-nav/language-nav';
import { Menu } from './menu/menu';
import { useExportDiagram } from '@/hooks/use-export-diagram';
import { useExportImage } from '@/hooks/use-export-image';
import { useChartDB } from '@/hooks/use-chartdb';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button/button';
import { SaveIcon, CopyIcon, ImageIcon } from 'lucide-react';

export interface TopNavbarProps {}

export const TopNavbar: React.FC<TopNavbarProps> = () => {
    const { effectiveTheme } = useTheme();
    const { exportDiagram } = useExportDiagram();
    const { exportImage } = useExportImage();
    const { currentDiagram } = useChartDB();
    const { t } = useTranslation();

    // Состояния для кнопок
    const [saveButtonState, setSaveButtonState] = useState<
        'idle' | 'loading' | 'success'
    >('idle');
    const [urlButtonState, setUrlButtonState] = useState<
        'idle' | 'loading' | 'success'
    >('idle');
    const [pngButtonState, setPngButtonState] = useState<
        'idle' | 'loading' | 'success'
    >('idle');

    // Состояние для отслеживания изменений в диаграмме
    const [diagramChanged, setDiagramChanged] = useState(false);

    // Состояние для отслеживания, была ли диаграмма открыта из MinIO или сохранена в MinIO
    const [isMinIODiagram, setIsMinIODiagram] = useState(false);

    // Предыдущее состояние диаграммы для отслеживания изменений
    const previousDiagramRef = useRef<string>('');

    // Получаем параметры URL
    const [searchParams] = useSearchParams();
    const minioParam = searchParams.get('minio');

    // Проверяем, была ли диаграмма открыта из MinIO
    useEffect(() => {
        // Если в URL есть параметр minio, значит диаграмма связана с MinIO
        if (minioParam) {
            console.log('Diagram opened from MinIO with param:', minioParam);
            setIsMinIODiagram(true);
        }
    }, [minioParam]);

    const renderStars = useCallback(() => {
        return (
            <iframe
                src={`https://ghbtns.com/github-btn.html?user=chartdb&repo=chartdb&type=star&size=large&text=false`}
                width="40"
                height="30"
                title="GitHub"
            ></iframe>
        );
    }, []);

    // Отслеживаем изменения в диаграмме по ее сериализованному значению
    useEffect(() => {
        if (!currentDiagram) return;

        // Сериализуем только важные части диаграммы для сравнения
        const diagramContent = {
            tables: currentDiagram.tables || [],
            relationships: currentDiagram.relationships || [],
            dependencies: currentDiagram.dependencies || [],
            areas: currentDiagram.areas || [],
        };
        const currentDiagramString = JSON.stringify(diagramContent);

        // Если это первая загрузка диаграммы
        if (!previousDiagramRef.current) {
            previousDiagramRef.current = currentDiagramString;
            return;
        }

        // Если диаграмма изменилась
        if (previousDiagramRef.current !== currentDiagramString) {
            // Устанавливаем флаг изменения только если диаграмма связана с MinIO
            if (isMinIODiagram) {
                console.log('Diagram changed and related to MinIO');
                setDiagramChanged(true);
            } else {
                console.log('Diagram changed but not related to MinIO');
            }
        }

        // Обновляем ссылку на предыдущее состояние
        previousDiagramRef.current = currentDiagramString;
    }, [currentDiagram, isMinIODiagram]);

    // Функция для сохранения в MinIO
    const saveToMinIO = useCallback(async () => {
        // Изменяем состояние кнопки на загрузку
        setSaveButtonState('loading');

        try {
            // Экспорт диаграммы в MinIO
            await exportDiagram({
                diagram: currentDiagram,
                destination: 'minio',
            });

            console.log('Successfully saved to MinIO');

            // Устанавливаем флаг, что диаграмма связана с MinIO
            setIsMinIODiagram(true);

            // Сбрасываем флаг измененной диаграммы
            setDiagramChanged(false);

            // Обновляем ссылку на предыдущее состояние
            previousDiagramRef.current = JSON.stringify({
                tables: currentDiagram.tables || [],
                relationships: currentDiagram.relationships || [],
                dependencies: currentDiagram.dependencies || [],
                areas: currentDiagram.areas || [],
            });

            // Меняем состояние кнопки на успех
            setSaveButtonState('success');

            // Возвращаем исходное состояние через 2 секунды
            setTimeout(() => {
                console.log('Resetting button state to idle');
                setSaveButtonState('idle');
            }, 2000);
        } catch (error) {
            console.error('Error saving to MinIO:', error);

            // Создаем уведомление об ошибке
            const toast = document.createElement('div');
            toast.className =
                'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md z-50 transition-opacity duration-500';
            toast.innerHTML = `<p>${t('error_saving_to_minio')}</p>`;
            document.body.appendChild(toast);

            // Возвращаем исходное состояние кнопки
            setSaveButtonState('idle');

            // Удаляем уведомление об ошибке через 3 секунды
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 500);
            }, 3000);
        }
    }, [exportDiagram, currentDiagram, t]);

    // Функция для копирования URL
    const copyUrl = useCallback(async () => {
        // Изменяем состояние кнопки на загрузку
        setUrlButtonState('loading');

        try {
            // Получаем текущий URL
            const url = new URL(window.location.href);

            // Устанавливаем путь на корень
            url.pathname = '/';

            // Добавляем параметр minio с именем текущей диаграммы
            url.searchParams.set('minio', currentDiagram.name);

            // Копируем URL в буфер обмена
            await navigator.clipboard.writeText(url.toString());

            // Меняем состояние кнопки на успех
            setUrlButtonState('success');

            // Возвращаем исходное состояние через 2 секунды
            setTimeout(() => {
                setUrlButtonState('idle');
            }, 2000);
        } catch (error) {
            console.error('Error copying URL to clipboard:', error);

            // Создаем уведомление об ошибке
            const errorElement = document.createElement('div');
            errorElement.className =
                'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md z-50 transition-opacity duration-500';
            errorElement.innerHTML = `<p>Error copying URL</p>`;
            document.body.appendChild(errorElement);

            // Возвращаем исходное состояние кнопки
            setUrlButtonState('idle');

            // Удаляем уведомление через 3 секунды
            setTimeout(() => {
                errorElement.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(errorElement);
                }, 500);
            }, 3000);
        }
    }, [currentDiagram]);

    // Функция для копирования PNG
    const copyPngToClipboard = useCallback(async () => {
        // Изменяем состояние кнопки на загрузку
        setPngButtonState('loading');

        try {
            // Получаем PNG с прозрачным фоном
            const pngUrl = await exportImage('png', {
                scale: 2, // Увеличиваем масштаб для лучшего качества
                transparent: true, // Прозрачный фон
                includePatternBG: false, // Без фонового узора
            });

            // Получаем Blob из URL
            const response = await fetch(pngUrl);
            const blob = await response.blob();

            // Копируем в буфер обмена
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob,
                }),
            ]);

            // Меняем состояние кнопки на успех
            setPngButtonState('success');

            // Возвращаем исходное состояние через 2 секунды
            setTimeout(() => {
                setPngButtonState('idle');
            }, 2000);

            console.log('Diagram copied to clipboard as PNG');
        } catch (error) {
            console.error('Error copying PNG to clipboard:', error);

            // Создаем уведомление об ошибке
            const errorElement = document.createElement('div');
            errorElement.className =
                'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md z-50 transition-opacity duration-500';
            errorElement.innerHTML = `<p>Error copying PNG</p>`;
            document.body.appendChild(errorElement);

            // Возвращаем исходное состояние кнопки
            setPngButtonState('idle');

            // Удаляем уведомление через 3 секунды
            setTimeout(() => {
                errorElement.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(errorElement);
                }, 500);
            }, 3000);
        }
    }, [exportImage]);

    return (
        <nav className="flex flex-col justify-between border-b px-3 md:h-12 md:flex-row md:items-center md:px-4">
            <div className="flex flex-1 flex-col justify-between gap-x-1 md:flex-row md:justify-normal">
                <div className="flex items-center justify-between pt-[8px] font-primary md:py-[10px]">
                    <a
                        href="https://chartdb.io"
                        className="cursor-pointer"
                        rel="noreferrer"
                    >
                        <img
                            src={
                                effectiveTheme === 'light'
                                    ? ChartDBLogo
                                    : ChartDBDarkLogo
                            }
                            alt="chartDB"
                            className="h-4 max-w-fit"
                        />
                    </a>
                </div>
                <Menu />
            </div>
            <DiagramName />
            <div className="hidden flex-1 items-center justify-end gap-2 sm:flex">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={saveToMinIO}
                    className={`flex w-[160px] items-center justify-center gap-1 transition-colors duration-300 ${
                        saveButtonState === 'loading'
                            ? 'bg-blue-500 text-white hover:bg-blue-600 hover:text-white'
                            : saveButtonState === 'success'
                              ? 'bg-green-500 text-white hover:bg-green-600 hover:text-white'
                              : diagramChanged && isMinIODiagram
                                ? 'bg-red-500 text-white hover:bg-red-600 hover:text-white'
                                : ''
                    }`}
                    data-minio-diagram={String(isMinIODiagram)}
                    data-diagram-changed={String(diagramChanged)}
                >
                    <SaveIcon className="size-4 shrink-0" />
                    <span className="hidden truncate md:inline">
                        {saveButtonState === 'idle'
                            ? t('top_navbar.button_save_to_minio')
                            : saveButtonState === 'loading'
                              ? t('top_navbar.button_save_to_minio_loading')
                              : t('top_navbar.button_save_to_minio_success')}
                    </span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={copyUrl}
                    disabled={!isMinIODiagram}
                    className={`flex w-[160px] items-center justify-center gap-1 transition-colors duration-300 ${
                        urlButtonState === 'loading'
                            ? 'bg-blue-500 text-white hover:bg-blue-600 hover:text-white'
                            : urlButtonState === 'success'
                              ? 'bg-green-500 text-white hover:bg-green-600 hover:text-white'
                              : ''
                    }`}
                >
                    <CopyIcon className="size-4 shrink-0" />
                    <span className="hidden truncate md:inline">
                        {urlButtonState === 'idle'
                            ? t('top_navbar.button_copy_url')
                            : urlButtonState === 'loading'
                              ? t('top_navbar.button_copy_url_loading')
                              : t('top_navbar.button_copy_url_success')}
                    </span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={copyPngToClipboard}
                    className={`flex w-[160px] items-center justify-center gap-1 transition-colors duration-300 ${
                        pngButtonState === 'loading'
                            ? 'bg-blue-500 text-white hover:bg-blue-600 hover:text-white'
                            : pngButtonState === 'success'
                              ? 'bg-green-500 text-white hover:bg-green-600 hover:text-white'
                              : ''
                    }`}
                >
                    <ImageIcon className="size-4 shrink-0" />
                    <span className="hidden truncate md:inline">
                        {pngButtonState === 'idle'
                            ? t('top_navbar.button_copy_png')
                            : pngButtonState === 'loading'
                              ? t('top_navbar.button_copy_png_loading')
                              : t('top_navbar.button_copy_png_success')}
                    </span>
                </Button>
                <LastSaved />
                {renderStars()}
                <LanguageNav />
            </div>
        </nav>
    );
};
