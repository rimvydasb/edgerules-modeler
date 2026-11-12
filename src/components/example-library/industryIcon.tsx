import {
    IconBuildingBank,
    IconBolt,
    IconBuildingFactory,
    IconBuildingStore,
    IconFolder,
    IconHeartbeat,
    IconPlane,
    IconPuzzle,
    IconShieldCheck,
    IconTruckDelivery,
    IconWifi,
    IconBuildingCommunity,
    type Icon,
} from '@tabler/icons-react';
import type {ReactElement} from 'react';

const ICONS: Record<string, Icon> = {
    bank: IconBuildingBank,
    plane: IconPlane,
    aviation: IconPlane,
    shield: IconShieldCheck,
    insurance: IconShieldCheck,
    heart: IconHeartbeat,
    healthcare: IconHeartbeat,
    truck: IconTruckDelivery,
    logistics: IconTruckDelivery,
    store: IconBuildingStore,
    retail: IconBuildingStore,
    wifi: IconWifi,
    telco: IconWifi,
    government: IconBuildingCommunity,
    public: IconBuildingCommunity,
    bolt: IconBolt,
    energy: IconBolt,
    factory: IconBuildingFactory,
    manufacturing: IconBuildingFactory,
    puzzle: IconPuzzle,
};

/** The icon of an industry by its `icon` name or id; a folder when none matches. */
export function IndustryIcon({name, size = 24}: {name?: string; size?: number}): ReactElement {
    const Component = (name && ICONS[name.toLowerCase()]) || IconFolder;
    return <Component size={size} aria-hidden="true" />;
}
