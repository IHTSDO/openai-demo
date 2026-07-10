import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CodingTabsComponent } from './coding-tabs/coding-tabs.component';
import { MatTabsModule } from '@angular/material/tabs';
import { BindingComponent } from './binding/binding.component';
import { MatGridListModule } from '@angular/material/grid-list';
import { AutocompleteBindingComponent } from './autocomplete-binding/autocomplete-binding.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BindingDetailsComponent } from './binding-details/binding-details.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { DropdownBindingComponent } from './dropdown-binding/dropdown-binding.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SingleCodingComponent } from './single-coding/single-coding.component';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { OpenaiTestComponent } from './openai-test/openai-test.component';
import { TypewriterComponent } from './typewriter/typewriter';
import { HighlightTooltipDirective } from './hightlight-tooltip.directive';
import { DescriptionGeneratorComponent } from './description-generator/description-generator.component';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableModule } from '@angular/material/table';
import { TranslationComponent } from './translation/translation.component';
import { PatientFriendlyComponent } from './patient-friendly/patient-friendly.component';
import { EclExplainComponent } from './ecl-explain/ecl-explain.component';
import { SupportQuestionComponent } from './support-question/support-question.component';
import { FhirSummarizeComponent } from './fhir-summarize/fhir-summarize.component';
import { MatChipsModule } from '@angular/material/chips';
import { AiWarningDialogComponent } from './ai-warning-dialog/ai-warning-dialog.component';
import { NlpFunctionComponent } from './nlp-function/nlp-function.component';
import { EntityTraceDialogComponent } from './entity-trace-dialog/entity-trace-dialog.component';
import { MarkdownModule } from 'ngx-markdown';
import { MarkdownPipe } from './pipes/markdown.pipe';
import { YouTubePlayerModule } from '@angular/youtube-player';

@NgModule({ declarations: [
        AppComponent,
        CodingTabsComponent,
        BindingComponent,
        AutocompleteBindingComponent,
        BindingDetailsComponent,
        DropdownBindingComponent,
        SingleCodingComponent,
        OpenaiTestComponent,
        TypewriterComponent,
        HighlightTooltipDirective,
        DescriptionGeneratorComponent,
        TranslationComponent,
        PatientFriendlyComponent,
        EclExplainComponent,
        SupportQuestionComponent,
        FhirSummarizeComponent,
        AiWarningDialogComponent,
        NlpFunctionComponent,
        EntityTraceDialogComponent,
        MarkdownPipe
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        MatToolbarModule,
        MatIconModule,
        MatButtonModule,
        MatTabsModule,
        MatGridListModule,
        MatFormFieldModule,
        MatSelectModule,
        MatAutocompleteModule,
        FormsModule,
        ReactiveFormsModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatDialogModule,
        MatListModule,
        ClipboardModule,
        MatMenuModule,
        MatTooltipModule,
        MatCardModule,
        MatSnackBarModule,
        MatRadioModule,
        MatTableModule,
        MatChipsModule,
        MarkdownModule.forRoot(),
        YouTubePlayerModule], providers: [provideHttpClient(withInterceptorsFromDi())] })
export class AppModule { }
