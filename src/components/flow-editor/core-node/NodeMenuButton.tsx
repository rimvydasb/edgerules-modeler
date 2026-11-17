import {IconDotsVertical} from '@tabler/icons-react';
import type {ReactElement} from 'react';
import {RowActionsMenu} from '#ui/RowActionsMenu';
import type {NodeMenuButtonProps} from './types';
import styles from './coreNode.module.css';

/** A kebab that opens a node or row menu. Renders nothing when there are no items. */
export function NodeMenuButton({
    items,
    ariaLabel,
    footer,
    variant = 'node',
    align = 'end',
}: NodeMenuButtonProps): ReactElement | null {
    if (items.length === 0) return null;
    const className =
        variant === 'node' ? styles.kebab : `${styles.rowKebab} ${align === 'start' ? styles.kebabStart : ''}`;
    // A click on the kebab or on an item opens or runs the menu only: it does not select the node. React bubbles the
    // clicks of the portalled menu through this element too. A selected node opens the split screen of the Shell,
    // which narrows the canvas and can move the node, and with it the open menu, out of view.
    return (
        <span className={styles.menuAnchor} onClick={(event) => event.stopPropagation()}>
            <RowActionsMenu items={items} footer={footer}>
                <button type="button" className={`${className} nodrag`} aria-label={ariaLabel} aria-haspopup="menu">
                    <IconDotsVertical size={variant === 'node' ? 16 : 15} />
                </button>
            </RowActionsMenu>
        </span>
    );
}
