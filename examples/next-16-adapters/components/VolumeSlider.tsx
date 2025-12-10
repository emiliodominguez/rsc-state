"use client";

interface VolumeSliderProps {
	currentVolume: number;
}

export function VolumeSlider({ currentVolume }: VolumeSliderProps): React.ReactNode {
	return (
		<input
			type="range"
			name="volume"
			min="0"
			max="100"
			defaultValue={currentVolume}
			className="range"
			onChange={(e) => e.currentTarget.form?.requestSubmit()}
		/>
	);
}
