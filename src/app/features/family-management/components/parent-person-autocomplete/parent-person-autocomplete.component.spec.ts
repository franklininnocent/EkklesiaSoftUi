import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { ParentPersonAutocompleteComponent } from './parent-person-autocomplete.component';
import { ParishPersonService } from '@features/settings/sacraments/services/person.service';

describe('ParentPersonAutocompleteComponent', () => {
  let component: ParentPersonAutocompleteComponent;
  let fixture: ComponentFixture<ParentPersonAutocompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentPersonAutocompleteComponent, FormsModule, ReactiveFormsModule],
      providers: [
        {
          provide: ParishPersonService,
          useValue: {
            searchForParent: () => of({ success: true, data: [] }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ParentPersonAutocompleteComponent);
    component = fixture.componentInstance;
    component.mode = 'father';
    fixture.detectChanges();
  });

  it('emits direct text when typed without selecting a record', () => {
    const emitted: unknown[] = [];
    component.registerOnChange((value) => emitted.push(value));
    component.onQueryChange('Joseph Peter');
    expect(emitted[0]).toEqual({
      person_id: null,
      name: 'Joseph Peter',
      linked: false,
    });
  });

  it('unlink keeps the name but clears the person id', () => {
    component.writeValue({
      person_id: 'uuid-1',
      name: 'Joseph Peter',
      linked: true,
    });
    const emitted: unknown[] = [];
    component.registerOnChange((value) => emitted.push(value));
    component.unlink();
    expect(emitted[0]).toEqual({
      person_id: null,
      name: 'Joseph Peter',
      linked: false,
    });
  });
});
