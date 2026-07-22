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
  host: { class: 'block w-[440px] max-w-[calc(100vw-2rem)]' },
  template: `
    <app-modal [title]="'Create voice room'" [noPadding]="true">
      <form class="flex flex-col gap-5 pt-5 px-5 pb-0" (submit)="onSubmit($event)">
        <div class="flex flex-col gap-2 relative">
          <app-input
            label="Room name"
            placeholder="What's happening?"
            [formField]="roomForm.name"
            autocomplete="off"
          />
          <span
            class="self-end text-[11px] text-neutral-500"
            [class.text-red-500]="model().name.trim().length > MAX_NAME"
            [class.font-medium]="model().name.trim().length > MAX_NAME"
            aria-hidden="true"
          >
            {{ model().name.trim().length }}/{{ MAX_NAME }}
          </span>
        </div>

        <div class="flex gap-4">
          <div class="flex-1 min-w-0 flex flex-col gap-2 relative">
            <label class="flex items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-200" for="create-room-lang">
              <svg aria-hidden="true" lucideGlobe [size]="13" class="text-blue-500" />
              Language
            </label>
            <app-language-select id="create-room-lang" [(value)]="langId" />
          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-2 relative">
            <label class="flex items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-200" for="create-room-category">
              <svg aria-hidden="true" lucideTag [size]="13" class="text-blue-500" />
              Category
            </label>
            <app-category-select
              id="create-room-category"
              [categories]="categories()"
              [(value)]="categoryId"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2 relative">
          <span class="flex items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-200" id="visibility-label">Visibility</span>
          <ul
            ngListbox
            [multi]="false"
            orientation="horizontal"
            aria-labelledby="visibility-label"
            class="flex gap-2 list-none m-0 p-0"
            [(value)]="visibilitySelection"
          >
            <li
              ngOption
              value="public"
              label="Public"
              class="group flex-1 flex items-center gap-2 p-4 border-[1.5px] border-neutral-200 dark:border-neutral-700
                     rounded-lg bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 cursor-pointer relative
                     hover:bg-neutral-50 hover:border-neutral-300
                     dark:hover:bg-neutral-700 dark:hover:text-neutral-100 dark:hover:border-neutral-600
                     aria-selected:border-blue-500 aria-selected:bg-blue-50 aria-selected:text-blue-700
                     aria-selected:shadow-[0_4px_12px_-4px_rgb(59_130_246/35%)]
                     dark:aria-selected:bg-blue-900 dark:aria-selected:text-blue-300 dark:aria-selected:border-blue-600
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <span class="flex items-center justify-center w-9 h-9 rounded-md bg-neutral-100 dark:bg-neutral-700
                           text-neutral-600 dark:text-neutral-300 shrink-0
                           group-aria-selected:bg-blue-500 group-aria-selected:text-white dark:group-aria-selected:bg-blue-400">
                <svg aria-hidden="true" lucideUnlock [size]="15" />
              </span>
              <span class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm font-semibold leading-tight group-aria-selected:text-blue-700 dark:group-aria-selected:text-blue-300">Public</span>
                <span class="text-[11px] text-neutral-500 leading-[1.3]">Anyone can find and join</span>
              </span>
              <span
                class="absolute top-2 right-2 flex items-center justify-center w-[18px] h-[18px] rounded-full
                       bg-blue-500 text-white opacity-0 scale-[0.6] group-aria-selected:opacity-100 group-aria-selected:scale-100"
                aria-hidden="true"
              >
                <svg lucideCheck [size]="12" />
              </span>
            </li>
            <li
              ngOption
              value="private"
              label="Private"
              class="group flex-1 flex items-center gap-2 p-4 border-[1.5px] border-neutral-200 dark:border-neutral-700
                     rounded-lg bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 cursor-pointer relative
                     hover:bg-neutral-50 hover:border-neutral-300
                     dark:hover:bg-neutral-700 dark:hover:text-neutral-100 dark:hover:border-neutral-600
                     aria-selected:border-blue-500 aria-selected:bg-blue-50 aria-selected:text-blue-700
                     aria-selected:shadow-[0_4px_12px_-4px_rgb(59_130_246/35%)]
                     dark:aria-selected:bg-blue-900 dark:aria-selected:text-blue-300 dark:aria-selected:border-blue-600
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <span class="flex items-center justify-center w-9 h-9 rounded-md bg-neutral-100 dark:bg-neutral-700
                           text-neutral-600 dark:text-neutral-300 shrink-0
                           group-aria-selected:bg-blue-500 group-aria-selected:text-white dark:group-aria-selected:bg-blue-400">
                <svg aria-hidden="true" lucideLock [size]="15" />
              </span>
              <span class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm font-semibold leading-tight group-aria-selected:text-blue-700 dark:group-aria-selected:text-blue-300">Private</span>
                <span class="text-[11px] text-neutral-500 leading-[1.3]">Invite-only access</span>
              </span>
              <span
                class="absolute top-2 right-2 flex items-center justify-center w-[18px] h-[18px] rounded-full
                       bg-blue-500 text-white opacity-0 scale-[0.6] group-aria-selected:opacity-100 group-aria-selected:scale-100"
                aria-hidden="true"
              >
                <svg lucideCheck [size]="12" />
              </span>
            </li>
          </ul>
        </div>

        <div class="flex flex-col gap-2 relative">
          <app-input
            label="Topic (optional)"
            placeholder="Add a topic or notice for your room"
            [formField]="roomForm.notice"
            autocomplete="off"
          />
          <span
            class="self-end text-[11px] text-neutral-500"
            [class.text-red-500]="model().notice.trim().length > MAX_NOTICE"
            [class.font-medium]="model().notice.trim().length > MAX_NOTICE"
            aria-hidden="true"
          >
            {{ model().notice.trim().length }}/{{ MAX_NOTICE }}
          </span>
        </div>

        <div class="flex justify-end items-center gap-2 py-5 border-t border-neutral-200 dark:border-neutral-700">
          <app-button type="button" variant="ghost" size="md" (click)="ref.close()"
            >Cancel</app-button
          >
          <app-button
            type="submit"
            variant="primary"
            size="md"
            [pill]="true"
            [disabled]="roomForm().invalid()"
            class="flex-1 max-w-[200px]"
          >
            <svg aria-hidden="true" lucideRadio [size]="14" />
            Start room
          </app-button>
        </div>
      </form>
    </app-modal>
  `,
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
