import React from 'react';
import { t } from '../utils/i18n';

const Footer = ({ version, ui }) => {
    const currentYear = new Date().getFullYear();
    const displayYear = currentYear > 2026 ? `2026 - ${currentYear}` : '2026';

    return (
        <footer>
            <p style={{ margin: '5px 0' }}>
                <strong>Open StageLive</strong> {version && `v${version}`}
                <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                <span style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>CC BY-NC-SA 4.0 License</span>
            </p>

            <p style={{ margin: '5px 0', fontSize: '75%' }}>
                {t(ui, 'MAKE_BY', 'Réalisé par')} <strong>Déléage Arthur</strong>
            </p>

            <div style={{ marginTop: '10px', fontSize: '65%', fontStyle: 'italic' }}>
                © {displayYear} Open StageLive. {t(ui, 'FOOTER_ALL_RIGHTS')}.
            </div>
        </footer>
    );
};

export default Footer;