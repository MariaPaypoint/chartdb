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
import { autoCropImage } from '@/utils/image-utils';

export interface TopNavbarProps {}

export const TopNavbar: React.FC<TopNavbarProps> = () => {
    const { effectiveTheme } = useTheme();
    const { exportDiagram } = useExportDiagram();
    const { exportImage } = useExportImage();
    const { currentDiagram } = useChartDB();
    const { t } = useTranslation();

    // Button states
    const [saveButtonState, setSaveButtonState] = useState<
        'idle' | 'loading' | 'success'
    >('idle');
    const [urlButtonState, setUrlButtonState] = useState<
        'idle' | 'loading' | 'success'
    >('idle');
    const [pngButtonState, setPngButtonState] = useState<
        'idle' | 'loading' | 'success'
    >('idle');

    // State for tracking diagram changes
    const [diagramChanged, setDiagramChanged] = useState(false);

    // State for tracking if the diagram was opened from MinIO or saved to MinIO
    const [isMinIODiagram, setIsMinIODiagram] = useState(false);

    // Previous diagram state for tracking changes
    const previousDiagramRef = useRef<string>('');

    // Get URL parameters
    const [searchParams] = useSearchParams();
    const minioParam = searchParams.get('minio');

    // Check if the diagram was opened from MinIO
    useEffect(() => {
        // If the URL has a minio parameter, the diagram is associated with MinIO
        if (minioParam) {
            console.log(
                'DEBUG: Diagram opened from MinIO with param:',
                minioParam
            );
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

    // Track changes in the diagram by its serialized value
    useEffect(() => {
        if (!currentDiagram) return;

        // Serialize only important parts of the diagram for comparison
        const diagramContent = {
            tables: currentDiagram.tables || [],
            relationships: currentDiagram.relationships || [],
            dependencies: currentDiagram.dependencies || [],
            areas: currentDiagram.areas || [],
        };
        const currentDiagramString = JSON.stringify(diagramContent);

        // If this is the first diagram load
        if (!previousDiagramRef.current) {
            previousDiagramRef.current = currentDiagramString;
            return;
        }

        // If the diagram has changed
        if (previousDiagramRef.current !== currentDiagramString) {
            // Set the change flag only if the diagram is associated with MinIO
            if (isMinIODiagram) {
                console.log('DEBUG: Diagram changed and related to MinIO');
                setDiagramChanged(true);
            } else {
                console.log('DEBUG: Diagram changed but not related to MinIO');
            }
        }

        // Update the reference to the previous state
        previousDiagramRef.current = currentDiagramString;
    }, [currentDiagram, isMinIODiagram]);

    // Function to save to MinIO
    const saveToMinIO = useCallback(async () => {
        // Change button state to loading
        setSaveButtonState('loading');

        try {
            // Export diagram to MinIO
            await exportDiagram({
                diagram: currentDiagram,
                destination: 'minio',
            });

            console.log('DEBUG: Successfully saved to MinIO');

            // Set flag that diagram is associated with MinIO
            setIsMinIODiagram(true);

            // Reset the changed diagram flag
            setDiagramChanged(false);

            // Update the reference to the previous state
            previousDiagramRef.current = JSON.stringify({
                tables: currentDiagram.tables || [],
                relationships: currentDiagram.relationships || [],
                dependencies: currentDiagram.dependencies || [],
                areas: currentDiagram.areas || [],
            });

            // Change button state to success
            setSaveButtonState('success');

            // Return to original state after 2 seconds
            setTimeout(() => {
                console.log('DEBUG: Resetting button state to idle');
                setSaveButtonState('idle');
            }, 2000);
        } catch (error) {
            console.error('Error saving to MinIO:', error);

            // Create error notification
            const toast = document.createElement('div');
            toast.className =
                'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md z-50 transition-opacity duration-500';
            toast.innerHTML = `<p>${t('error_saving_to_minio')}</p>`;
            document.body.appendChild(toast);

            // Return to original button state
            setSaveButtonState('idle');

            // Remove error notification after 3 seconds
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 500);
            }, 3000);
        }
    }, [exportDiagram, currentDiagram, t]);

    // Function to copy URL
    const copyUrl = useCallback(async () => {
        // Change button state to loading
        setUrlButtonState('loading');

        try {
            // Get current URL
            const url = new URL(window.location.href);

            // Set path to root
            url.pathname = '/';

            // Add minio parameter with current diagram name
            url.searchParams.set('minio', currentDiagram.name);

            // Copy URL to clipboard
            await navigator.clipboard.writeText(url.toString());

            // Change button state to success
            setUrlButtonState('success');

            // Return to original state after 2 seconds
            setTimeout(() => {
                setUrlButtonState('idle');
            }, 2000);
        } catch (error) {
            console.error('Error copying URL to clipboard:', error);

            // Create error notification
            const errorElement = document.createElement('div');
            errorElement.className =
                'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md z-50 transition-opacity duration-500';
            errorElement.innerHTML = `<p>Error copying URL</p>`;
            document.body.appendChild(errorElement);

            // Return to original button state
            setUrlButtonState('idle');

            // Remove notification after 3 seconds
            setTimeout(() => {
                errorElement.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(errorElement);
                }, 500);
            }, 3000);
        }
    }, [currentDiagram]);

    // Function to copy PNG
    const copyPngToClipboard = useCallback(async () => {
        // Change button state to loading
        setPngButtonState('loading');

        try {
            // Get PNG with transparent background
            const pngUrl = await exportImage('png', {
                scale: 2, // Increase scale for better quality
                transparent: true, // Transparent background
                includePatternBG: false, // Without background pattern
            });

            // Apply automatic cropping of empty space
            console.log('[top-navbar] Applying automatic cropping');
            const croppedPngUrl = await autoCropImage(pngUrl, 50, 'png');

            // Get Blob from URL
            const response = await fetch(croppedPngUrl);
            const blob = await response.blob();

            // Copy to clipboard
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob,
                }),
            ]);

            // Change button state to success
            setPngButtonState('success');

            // Return to original state after 2 seconds
            setTimeout(() => {
                setPngButtonState('idle');
            }, 2000);

            console.log('Diagram copied to clipboard as PNG');
        } catch (error) {
            console.error('Error copying PNG to clipboard:', error);

            // Create error notification
            const errorElement = document.createElement('div');
            errorElement.className =
                'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md z-50 transition-opacity duration-500';
            errorElement.innerHTML = `<p>Error copying PNG</p>`;
            document.body.appendChild(errorElement);

            // Return to original button state
            setPngButtonState('idle');

            // Remove notification after 3 seconds
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
