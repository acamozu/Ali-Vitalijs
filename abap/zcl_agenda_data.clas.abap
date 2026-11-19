CLASS zcl_agenda_data DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  " Writes the agenda of the alseda Consulting Year-End Conference (27 Nov 2026, Frankfurt) into the tables
  " ZAGENDA_EVENT / ZAGENDA_ITEM, event YEC2026 - the same agenda as src/agenda.js of the web version.
  " Run with F9 in ADT (console application). If the event already has agenda items, nothing is changed:
  " to load the default agenda again, delete the rows of YEC2026 in ZAGENDA_ITEM first (SE16).
  " In the texts "~" marks a place where a long word may be broken (stored as a soft hyphen, U+00AD).

  PUBLIC SECTION.

    INTERFACES if_oo_adt_classrun .

  PRIVATE SECTION.

    CONSTANTS gc_event TYPE zagenda_event-event_id VALUE 'YEC2026'.

    DATA mt_item TYPE STANDARD TABLE OF zagenda_item WITH DEFAULT KEY.

    METHODS item
      IMPORTING iv_icon        TYPE clike
                iv_from        TYPE clike
                iv_to          TYPE clike DEFAULT ''
                iv_type        TYPE clike
                iv_title_de    TYPE clike
                iv_title_en    TYPE clike
                iv_subtitle_de TYPE clike DEFAULT ''
                iv_subtitle_en TYPE clike DEFAULT ''
                iv_speaker     TYPE clike DEFAULT ''
                iv_location    TYPE clike DEFAULT ''
                iv_section_de  TYPE clike DEFAULT ''
                iv_section_en  TYPE clike DEFAULT ''.

    METHODS text
      IMPORTING iv_text        TYPE clike
      RETURNING VALUE(rv_text) TYPE string.
ENDCLASS.



CLASS zcl_agenda_data IMPLEMENTATION.


  METHOD if_oo_adt_classrun~main.
    DATA ls_event TYPE zagenda_event.

    SELECT COUNT(*) FROM zagenda_item WHERE event_id = @gc_event.
    IF sy-dbcnt > 0.
      out->write( |Event { gc_event } already has { sy-dbcnt } agenda items - nothing changed.| ).
      RETURN.
    ENDIF.

    ls_event-mandt      = sy-mandt.
    ls_event-event_id   = gc_event.
    ls_event-title      = 'Year-End Conference'.
    ls_event-company    = 'alseda Consulting'.
    ls_event-event_date = '20261127'.
    ls_event-tz         = '+01:00'.
    ls_event-venue      = 'JW Marriott, Salon I'.
    ls_event-city       = 'Frankfurt'.
    ls_event-address    = 'Thurn-und-Taxis-Platz 2, 60313 Frankfurt'.
    ls_event-changed_by = sy-uname.
    GET TIME STAMP FIELD ls_event-changed_at.

    item( iv_icon = 'coffee' iv_from = '09:00' iv_to = '09:30' iv_type = 'break'
          iv_section_de = 'Konferenz' iv_section_en = 'Conference'
          iv_title_de = 'Willkommens~kaffee & Snacks' iv_title_en = 'Welcome Coffee & Snacks' ).
    item( iv_icon = 'hand' iv_from = '09:30' iv_to = '10:30' iv_type = 'session'
          iv_title_de = 'Offizielle Begrüßung' iv_title_en = 'Official Welcome' iv_speaker = 'Frank' ).
    item( iv_icon = 'coffee' iv_from = '10:30' iv_to = '10:45' iv_type = 'break'
          iv_title_de = 'Pause – Referenten~wechsel' iv_title_en = 'Break – Speaker Change' ).
    item( iv_icon = 'chart' iv_from = '10:45' iv_to = '11:15' iv_type = 'session'
          iv_title_de = 'Projekt~ausblick 2027' iv_title_en = 'Project Prospects 2027' iv_speaker = 'Oliver' ).
    item( iv_icon = 'coffee' iv_from = '11:15' iv_to = '11:30' iv_type = 'break'
          iv_title_de = 'Pause – Referenten~wechsel' iv_title_en = 'Break – Speaker Change' ).
    item( iv_icon = 'gauge' iv_from = '11:30' iv_to = '12:00' iv_type = 'session'
          iv_title_de = 'Load & Performance in SAP PE & TRBK' iv_title_en = 'Load & Performance in SAP PE & TRBK'
          iv_speaker = 'David / Julian' ).
    item( iv_icon = 'chat' iv_from = '12:00' iv_to = '12:30' iv_type = 'session'
          iv_title_de = 'Marketing Insights: Reflect, Connect & Celebrate'
          iv_title_en = 'Marketing Insights: Reflect, Connect & Celebrate' iv_speaker = 'Loredana' ).
    item( iv_icon = 'food' iv_from = '12:30' iv_to = '14:00' iv_type = 'break'
          iv_title_de = 'Pause – Mittagessen' iv_title_en = 'Break – Lunch' ).
    item( iv_icon = 'chip' iv_from = '14:00' iv_to = '14:30' iv_type = 'session'
          iv_title_de = 'KI-Live-Demo' iv_title_en = 'AI Live Demo' iv_speaker = 'Vitalijs / Ali' ).
    item( iv_icon = 'coin' iv_from = '14:30' iv_to = '15:00' iv_type = 'session'
          iv_title_de = 'Stablecoins: Hype oder Zukunft des Zahlungs~verkehrs?'
          iv_title_en = 'Stablecoins: Hype or the Future of Payments?'
          iv_subtitle_de = 'SAP Pay & alseda – Rückblick 2026 und Ausblick 2027'
          iv_subtitle_en = 'SAP Pay & alseda – Review 2026 and Outlook 2027' iv_speaker = 'Michael' ).
    item( iv_icon = 'star' iv_from = '15:00' iv_type = 'social'
          iv_section_de = 'Weihnachts~feier' iv_section_en = 'Christmas Party'
          iv_title_de = 'Beginn der Weihnachts~feier' iv_title_en = 'Start of the Christmas Party'
          iv_subtitle_de = 'Transfer zum ehemaligen Polizei~präsidium'
          iv_subtitle_en = 'Transfer to the Former Police Headquarters'
          iv_location = 'Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main' ).
    item( iv_icon = 'pin' iv_from = '16:00' iv_to = '18:00' iv_type = 'social'
          iv_title_de = 'Geführte Lost-Places-Tour' iv_title_en = 'Guided Lost Places Tour'
          iv_subtitle_de = '„Altes Polizei~präsidium Frankfurt“'
          iv_subtitle_en = '“Old Police Headquarters Frankfurt”'
          iv_location = 'Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main' ).
    item( iv_icon = 'bus' iv_from = '18:00' iv_type = 'social'
          iv_title_de = 'Transfer zum Casa Isoletta' iv_title_en = 'Transfer to Casa Isoletta'
          iv_subtitle_de = 'Vom Alten Polizei~präsidium Frankfurt'
          iv_subtitle_en = 'From the Old Police Headquarters Frankfurt'
          iv_location = 'Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main' ).
    item( iv_icon = 'food' iv_from = '19:00' iv_type = 'social'
          iv_title_de = 'Abendessen im Casa Isoletta' iv_title_en = 'Dinner at Casa Isoletta'
          iv_location = 'Babenhäuser Landstraße 1, 60599 Frankfurt am Main' ).

    MODIFY zagenda_event FROM @ls_event.
    INSERT zagenda_item FROM TABLE @mt_item.
    COMMIT WORK.

    out->write( |OK: event { gc_event } with { lines( mt_item ) } agenda items written.| ).
  ENDMETHOD.


  METHOD item.
    DATA ls_item TYPE zagenda_item.
    ls_item-mandt       = sy-mandt.
    ls_item-event_id    = gc_event.
    ls_item-pos         = lines( mt_item ) + 1.
    ls_item-icon        = iv_icon.
    ls_item-time_from   = iv_from.
    ls_item-time_to     = iv_to.
    ls_item-item_type   = iv_type.
    ls_item-section_de  = text( iv_section_de ).
    ls_item-section_en  = text( iv_section_en ).
    ls_item-title_de    = text( iv_title_de ).
    ls_item-title_en    = text( iv_title_en ).
    ls_item-subtitle_de = text( iv_subtitle_de ).
    ls_item-subtitle_en = text( iv_subtitle_en ).
    ls_item-speaker     = iv_speaker.
    ls_item-location    = iv_location.
    APPEND ls_item TO mt_item.
  ENDMETHOD.


  METHOD text.
    " "~" -> soft hyphen (U+00AD): the browser may break the word there, and only then shows a hyphen
    DATA(lv_soft_hyphen) = cl_abap_conv_in_ce=>uccp( '00AD' ).
    rv_text = iv_text.
    REPLACE ALL OCCURRENCES OF '~' IN rv_text WITH lv_soft_hyphen.
  ENDMETHOD.
ENDCLASS.
