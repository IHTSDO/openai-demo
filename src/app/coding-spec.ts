export const codingSpec = [
    {
        title: 'GROUP 1',
        description: 'The first group of bindings in the coding demonstration',
        bindings: [
            {
                title: 'Medicinal product + groupers',
                type: 'autocomplete',
                ecl: `<< 763158003 |Medicinal product| :
                        [0..0] 1142139005 |Count of base of active ingredient| = *,
                        [0..0] 411116001 |Has manufactured dose form| = *,
                        [0..0] 774158006 |Has product name| = *`,
                value: '',
                note: 'Medicinal products, contain at least provided ingredientes (open world assuption), no information on form.'
            },
            {
                title: 'Gender',
                type: 'dropdown',
                ecl: `< 365873007 |Gender finding (finding)|`,
                value: '',
                note: 'Patient gender.'
            },
            {
                title: 'Medicinal product form + groupers',
                type: 'autocomplete',
                ecl: `<< 763158003 |Medicinal product| :
                    [0..0] 1142139005 |Count of base of active ingredient| = *,
                    411116001 |Has manufactured dose form| = *,
                    [0..0] 774158006 |Has product name| = *`,
                value: '',
                note: 'Medicinal products, with form details.'
            }
        ]
    },
    {
        title: 'GROUP 2',
        description: 'The second group of bindings in the coding demonstration',
        bindings: [
            {
                title: 'Medicinal product only',
                type: 'autocomplete',
                ecl: `<< 763158003 |Medicinal product| :
                    1142139005 |Count of base of active ingredient| = *,
                    [0..0] 411116001 |Has manufactured dose form| = *,
                    [0..0] 774158006 |Has product name| = *`,
                value: '',
                note: 'Medicinal products, containing only the provided ingredientes (close world assuption), with no information on form.'
            },
            {
                title: 'Medicinal product form only',
                type: 'autocomplete',
                ecl: `<< 763158003 |Medicinal product| :
                    1142139005 |Count of base of active ingredient| = *,
                    411116001 |Has manufactured dose form| = *,
                    [0..0] 732943007 |Has basis of strength substance (attribute)| = *,
                    [0..0] 774158006 |Has product name| = *`,
                value: '',
                note: 'Medicinal products, with form details, containing only the provided ingredientes (close world assuption).'
            }
        ]
    }
]