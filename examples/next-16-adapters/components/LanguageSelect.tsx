"use client";

interface LanguageSelectProps {
	currentLanguage: "en" | "es" | "fr";
}

export function LanguageSelect({ currentLanguage }: LanguageSelectProps): React.ReactNode {
	return (
		<select name="language" defaultValue={currentLanguage} className="select" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="en">English</option>

			<option value="es">Español</option>

			<option value="fr">Français</option>
		</select>
	);
}
