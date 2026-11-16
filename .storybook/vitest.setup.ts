import {setProjectAnnotations} from '@storybook/react-vite';
import * as preview from './preview';

// The stories run as tests with the decorators and parameters of the Storybook preview.
setProjectAnnotations([preview]);
