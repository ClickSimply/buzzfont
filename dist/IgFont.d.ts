export interface IgoogleFont {
    kind: string;
    family: string;
    category: string;
    variants: string[];
    subsets: string[];
    version: string;
    lastModified: string;
    files: {
        [fontStyle: string]: string;
    };
}
