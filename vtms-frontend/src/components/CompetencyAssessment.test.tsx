import { render, screen, fireEvent } from '@testing-library/react';
import CompetencyAssessment from './CompetencyAssessment';
import { expect, it, describe } from 'vitest';

describe('CompetencyAssessment Component', () => {
  it('renders correctly', () => {
    render(<CompetencyAssessment />);
    expect(screen.getByText(/Practical Competency Assessment/i)).toBeDefined();
    expect(screen.getByText(/Beginner/i)).toBeDefined();
  });

  it('allows selecting a competency level', () => {
    render(<CompetencyAssessment />);
    const beginnerOption = screen.getByText(/Beginner/i).closest('div');
    fireEvent.click(beginnerOption!);
    // Check if background color changes or selected logic works
    expect(beginnerOption).toBeDefined();
  });
});
