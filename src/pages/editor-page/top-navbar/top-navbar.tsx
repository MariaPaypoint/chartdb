import React, { useCallback, useState, useEffect } from 'react';
import ChartDBLogo from '@/assets/logo-light.png';
import ChartDBDarkLogo from '@/assets/logo-dark.png';
import { useTheme } from '@/hooks/use-theme';
import { DiagramName } from './diagram-name';
import { LastSaved } from './last-saved';
import { LanguageNav } from './language-nav/language-nav';
import { Menu } from './menu/menu';
import { Badge } from '@/components/badge/badge';
import { CloudUpload } from 'lucide-react';
import { useExportDiagram } from '@/hooks/use-export-diagram';
import { useChartDB } from '@/hooks/use-chartdb';
// Удаляем неиспользуемый импорт useToast
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    // Состояния для управления видом кнопки
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [lastSavedDiagram, setLastSavedDiagram] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingSuccess, setIsSavingSuccess] = useState(false);

    // Отслеживаем изменения в диаграмме
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

                                    // Через 3 секунды убираем зеленый цвет
                                    setTimeout(() => {
                                        setIsSavingSuccess(false);
                                    }, 3000);
                                    // Успешное сохранение, уведомление не показываем
                                } catch (error) {
                                    console.error(
                                        'Ошибка при сохранении в MinIO:',
                                        error
                                    );
                                    setIsSaving(false);
                                    // При ошибке уведомление не показываем
                                }
                            }}
                        >
                            <CloudUpload size={16} />
                            <span>
                                {isSaving
                                    ? t('menu.backup.saving', 'Сохранение...')
                                    : isSavingSuccess
                                      ? t('menu.backup.saved', 'Сохранено')
                                      : t(
                                            'menu.backup.save_to_minio',
                                            'Сохранить в MinIO'
                                        )}
                            </span>
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        {t(
                            'menu.backup.save_to_minio_tooltip',
                            'Сохранить текущую диаграмму в MinIO'
                        )}
                    </TooltipContent>
                </Tooltip>
                {renderStars()}
                <LanguageNav />
            </div>
        </nav>
    );
};
