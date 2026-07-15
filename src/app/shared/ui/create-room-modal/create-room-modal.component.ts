import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  form,
  submit,
  required,
  validate,
  requiredError,
  maxLengthError,
  FormField,
} from '@angular/forms/signals';
import { ModalComponent } from '../modal/modal.component';
import { InputComponent } from '../input/input.component';
import { ButtonComponent } from '../button/button.component';
import { LanguageSelectComponent } from '../language-select/language-select';
import { CategorySelectComponent } from '../category-select/category-select';
import { LANGUAGES } from '@shared/data/languages';
import { Category } from '@shared/data/categories';
import {
  LucideRadio,
  LucideGlobe,
  LucideLock,
  LucideUnlock,
  LucideTag,
  LucideCheck,
} from '@lucide/angular';

export type RoomVisibility = 'public' | 'private';

export interface CreateRoomModalData {
  readonly categories: readonly Category[];
}

export interface CreateRoomResult {
  readonly name: string;
  readonly langId: number;
  readonly visibility: RoomVisibility;
  readonly notice: string;
  readonly categoryId: number | null;
  readonly topicId: number | null;
}

const MAX_NAME = 50;
const MAX_NOTICE = 200;

function trimmedMaxLengthError(value: string, max: number) {
  return value.trim().length > max
    ? maxLengthError(max, { message: `Max ${max} characters` })
    : undefined;
}

@Component({
  selector: 'app-create-room-modal',
  imports: [
    ModalComponent,
    Listbox,
    Option,
    FormField,
    InputComponent,
    ButtonComponent,
    LanguageSelectComponent,
    CategorySelectComponent,
    LucideRadio,
    LucideGlobe,
    LucideLock,
    LucideUnlock,
    LucideTag,
    LucideCheck,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="'Create voice room'" [noPadding]="true">
      <form class="form-body" (submit)="onSubmit($event)">
        <div class="field">
          <app-input
            label="Room name"
            placeholder="What's happening?"
            [formField]="roomForm.name"
            autocomplete="off"
          />
          <span
            class="char-count"
            [class.over]="model().name.trim().length > MAX_NAME"
            aria-hidden="true"
          >
            {{ model().name.trim().length }}/{{ MAX_NAME }}
          </span>
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field-label" for="create-room-lang">
              <svg aria-hidden="true" lucideGlobe [size]="13" />
              Language
            </label>
            <app-language-select id="create-room-lang" [(value)]="langId" />
          </div>
          <div class="field">
            <label class="field-label" for="create-room-category">
              <svg aria-hidden="true" lucideTag [size]="13" />
              Category
            </label>
            <app-category-select
              id="create-room-category"
              [categories]="categories()"
              [(value)]="categoryId"
            />
          </div>
        </div>

        <div class="field">
          <span class="field-label" id="visibility-label">Visibility</span>
          <ul
            ngListbox
            [multi]="false"
            orientation="horizontal"
            aria-labelledby="visibility-label"
            class="visibility-toggle"
            [(value)]="visibilitySelection"
          >
            <li ngOption value="public" label="Public" class="visibility-option">
              <span class="option-icon-wrap">
                <svg aria-hidden="true" lucideUnlock [size]="15" class="option-icon" />
              </span>
              <span class="option-text">
                <span class="option-title">Public</span>
                <span class="option-desc">Anyone can find and join</span>
              </span>
              <span class="option-check" aria-hidden="true">
                <svg lucideCheck [size]="12" />
              </span>
            </li>
            <li ngOption value="private" label="Private" class="visibility-option">
              <span class="option-icon-wrap">
                <svg aria-hidden="true" lucideLock [size]="15" class="option-icon" />
              </span>
              <span class="option-text">
                <span class="option-title">Private</span>
                <span class="option-desc">Invite-only access</span>
              </span>
              <span class="option-check" aria-hidden="true">
                <svg lucideCheck [size]="12" />
              </span>
            </li>
          </ul>
        </div>

        <div class="field">
          <app-input
            label="Topic (optional)"
            placeholder="Add a topic or notice for your room"
            [formField]="roomForm.notice"
            autocomplete="off"
          />
          <span
            class="char-count"
            [class.over]="model().notice.trim().length > MAX_NOTICE"
            aria-hidden="true"
          >
            {{ model().notice.trim().length }}/{{ MAX_NOTICE }}
          </span>
        </div>

        <div class="form-footer">
          <app-button type="button" variant="ghost" size="md" (click)="ref.close()"
            >Cancel</app-button
          >
          <app-button
            type="submit"
            variant="primary"
            size="md"
            [pill]="true"
            [disabled]="roomForm().invalid()"
            class="submit-btn"
          >
            <svg aria-hidden="true" lucideRadio [size]="14" />
            Start room
          </app-button>
        </div>
      </form>
    </app-modal>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 440px;
        max-width: calc(100vw - var(--space-8));
      }

      .form-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        padding: var(--space-5) var(--space-5) 0;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        position: relative;
      }

      .field-row {
        display: flex;
        gap: var(--space-4);
      }
      .field-row > .field {
        flex: 1;
        min-width: 0;
      }

      .char-count {
        align-self: flex-end;
        font-size: 11px;
        color: var(--color-text-muted);
      }
      .char-count.over {
        color: var(--color-warm-500);
        font-weight: var(--font-medium);
      }

      .field-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--color-text);
      }
      .field-label svg {
        color: var(--color-primary-500);
      }
      :host-context(.dark) .field-label {
        color: var(--color-neutral-200);
      }

      .visibility-toggle {
        display: flex;
        gap: var(--space-2);
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .visibility-option {
        flex: 1;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-4);
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-card);
        color: var(--color-text-secondary);
        cursor: pointer;
        position: relative;
      }
      .visibility-option:hover {
        background: var(--color-neutral-50);
        border-color: var(--color-neutral-300);
      }
      .visibility-option[aria-selected='true'] {
        border-color: var(--color-primary-500);
        background: var(--color-primary-50);
        color: var(--color-primary-text);
        box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--color-primary-500) 35%, transparent);
      }
      .visibility-option:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }
      :host-context(.dark) .visibility-option:hover {
        background: var(--color-neutral-700);
        color: var(--color-neutral-100);
        border-color: var(--color-neutral-600);
      }
      :host-context(.dark) .visibility-option[aria-selected='true'] {
        background: var(--color-primary-900);
        color: var(--color-primary-300);
        border-color: var(--color-primary-600);
      }

      .option-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        background: var(--color-neutral-100);
        color: var(--color-text-secondary);
        flex-shrink: 0;
      }
      .visibility-option[aria-selected='true'] .option-icon-wrap {
        background: var(--color-primary-500);
        color: var(--color-on-color);
      }
      :host-context(.dark) .option-icon-wrap {
        background: var(--color-neutral-700);
      }
      :host-context(.dark) .visibility-option[aria-selected='true'] .option-icon-wrap {
        background: var(--color-primary-400);
      }

      .option-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .option-title {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        line-height: 1.2;
      }
      .visibility-option[aria-selected='true'] .option-title {
        color: var(--color-primary-text);
      }
      :host-context(.dark) .visibility-option[aria-selected='true'] .option-title {
        color: var(--color-primary-300);
      }
      .option-desc {
        font-size: 11px;
        color: var(--color-text-muted);
        line-height: 1.3;
      }

      .option-check {
        position: absolute;
        top: var(--space-2);
        right: var(--space-2);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: var(--radius-full);
        background: var(--color-primary-500);
        color: var(--color-on-color);
        opacity: 0;
        transform: scale(0.6);
      }
      .visibility-option[aria-selected='true'] .option-check {
        opacity: 1;
        transform: scale(1);
      }

      .form-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-5) 0;
        border-top: 1px solid var(--color-border);
      }
      .submit-btn {
        flex: 1;
        max-width: 200px;
      }
    `,
  ],
})
export class CreateRoomModalComponent {
  protected readonly ref = inject(DialogRef);
  private readonly data = inject<CreateRoomModalData | null>(DIALOG_DATA, { optional: true });

  readonly MAX_NAME = MAX_NAME;
  readonly MAX_NOTICE = MAX_NOTICE;

  readonly categories = computed(() => this.data?.categories ?? []);

  readonly langId = signal<number>(LANGUAGES[0]?.id ?? 1);
  readonly categoryId = signal<number | null>(null);
  readonly topicId = computed(
    () =>
      this.categories().find((c: Category) => c.id === this.categoryId())?.topics[0]?.id ?? null,
  );
  readonly visibilitySelection = signal<RoomVisibility[]>(['public']);
  readonly visibility = computed<RoomVisibility>(() => this.visibilitySelection()[0] ?? 'public');

  readonly model = signal({ name: 'New Voice Room', notice: '' });

  readonly roomForm = form(this.model, (path) => {
    required(path.name, { message: 'Room name is required' });
    validate(path.name, ({ value }) =>
      value().trim().length === 0
        ? requiredError({ message: 'Room name is required' })
        : trimmedMaxLengthError(value(), MAX_NAME),
    );
    validate(path.notice, ({ value }) => trimmedMaxLengthError(value(), MAX_NOTICE));
  });

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.roomForm, async () => {
      this.ref.close({
        name: this.model().name.trim(),
        langId: this.langId(),
        visibility: this.visibility(),
        notice: this.model().notice.trim(),
        categoryId: this.categoryId(),
        topicId: this.topicId(),
      } satisfies CreateRoomResult);
    });
  }
}
