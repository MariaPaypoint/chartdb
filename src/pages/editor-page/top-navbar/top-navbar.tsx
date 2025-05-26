import React, { useCallback, useState, useEffect } from 'react';
import ChartDBLogo from '@/assets/logo-light.png';
import ChartDBDarkLogo from '@/assets/logo-dark.png';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { useChartDB } from '@/hooks/use-chartdb';
import { useExportImage } from '@/hooks/use-export-image';
import { DiagramName } from './diagram-name';
import { LastSaved } from './last-saved';
import { LanguageNav } from './language-nav/language-nav';
import { Menu } from './menu/menu';
import { Badge } from '@/components/badge/badge';
import { CloudUpload, Clipboard } from 'lucide-react';
import { useExportDiagram } from '@/hooks/use-export-diagram';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/tooltip/tooltip';

export interface TopNavbarProps {}

export const TopNavbar: React.FC<TopNavbarProps> = () => {
    const { effectiveTheme } = useTheme();
    const { exportDiagram } = useExportDiagram();
    const { currentDiagram } = useChartDB();
    const { exportImage } = useExportImage();
    const { t } = useTranslation();
    // States for button appearance management
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [lastSavedDiagram, setLastSavedDiagram] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingSuccess, setIsSavingSuccess] = useState(false);

    // Track changes in the diagram
    useEffect(() => {
        const currentDiagramString = JSON.stringify(currentDiagram);
        if (lastSavedDiagram && lastSavedDiagram !== currentDiagramString) {
            setHasUnsavedChanges(true);
        }
    }, [currentDiagram, lastSavedDiagram]);

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
                <LastSaved />
                <Tooltip>
                    <TooltipTrigger>
                        <Badge
                            variant="secondary"
                            className="flex cursor-pointer gap-1.5 whitespace-nowrap transition-all duration-300 ease-in-out"
                            onClick={async () => {
                                try {
                                    // Get PNG with transparent background
                                    const pngUrl = await exportImage('png', {
                                        scale: 2,
                                        transparent: true,
                                        includePatternBG: false,
                                    });

                                    // Get Blob from URL
                                    const response = await fetch(pngUrl);
                                    const blob = await response.blob();

                                    // Copy to clipboard
                                    await navigator.clipboard.write([
                                        new ClipboardItem({
                                            'image/png': blob,
                                        }),
                                    ]);

                                    // Visual feedback
                                    const badge =
                                        document.getElementById(
                                            'copy-svg-badge'
                                        );
                                    if (badge) {
                                        badge.classList.add(
                                            'bg-green-500',
                                            'text-white'
                                        );
                                        setTimeout(() => {
                                            badge.classList.remove(
                                                'bg-green-500',
                                                'text-white'
                                            );
                                        }, 1000);
                                    }
                                } catch (error) {
                                    console.error(
                                        'Error copying to clipboard:',
                                        error
                                    );
                                }
                            }}
                            id="copy-svg-badge"
                        >
                            <Clipboard size={16} />
                            <span>
                                {t(
                                    'menu.backup.copy_to_clipboard',
                                    'Copy as PNG'
                                )}
                            </span>
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        {t(
                            'menu.backup.copy_to_clipboard_tooltip',
                            'Copy diagram as PNG with transparent background'
                        )}
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <Badge
                            variant="secondary"
                            className={`flex cursor-pointer gap-1.5 whitespace-nowrap transition-all duration-500 ease-in-out ${isSaving ? 'bg-red-700 text-white hover:bg-red-700' : ''} ${isSavingSuccess ? '!bg-green-500 text-white hover:!bg-green-500' : ''} ${!isSaving && !isSavingSuccess && hasUnsavedChanges ? 'bg-red-500 text-white hover:bg-red-600' : ''}`}
                            onClick={async () => {
                                setIsSaving(true);
                                try {
                                    await exportDiagram({
                                        diagram: currentDiagram,
                                        destination: 'minio',
                                    });
                                    setHasUnsavedChanges(false);
                                    setIsSaving(false);
                                    setIsSavingSuccess(true);
                                    setLastSavedDiagram(
                                        JSON.stringify(currentDiagram)
                                    );

                                    // Remove green color after 3 seconds
                                    setTimeout(() => {
                                        setIsSavingSuccess(false);
                                    }, 3000);
                                    // Successful save, don't show notification
                                } catch (error) {
                                    console.error(
                                        'Error saving to MinIO:',
                                        error
                                    );
                                    setIsSaving(false);
                                    // Don't show notification on error
                                }
                            }}
                        >
                            <CloudUpload size={16} />
                            <span>
                                {isSaving
                                    ? t('menu.backup.saving', 'Saving...')
                                    : isSavingSuccess
                                      ? t('menu.backup.saved', 'Saved')
                                      : t(
                                            'menu.backup.save_to_minio',
                                            'Save to MinIO'
                                        )}
                            </span>
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        {t(
                            'menu.backup.save_to_minio_tooltip',
                            'Save current diagram to MinIO'
                        )}
                    </TooltipContent>
                </Tooltip>
                {renderStars()}
                <LanguageNav />
            </div>
        </nav>
    );
};
